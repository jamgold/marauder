var onlineCount = 0;

Session.setDefault('onlineCount', onlineCount);
Session.setDefault('message', '');

var debug = localStorage.getItem('debug');
if(debug !== null) Marauder.debug = true;

_.extend(Marauder, {
  timestamp: new Date(),
  markers: {
    myself: undefined,
    selected: undefined,
    infowindow: {},
    friends: {}
  },
  mode: function(mode) {
    var self = this;
    // if(Meteor.userId() === null)
    //   mode = 'home';

    if(mode === undefined)
    {
      mode = localStorage.getItem('mode');
      var valid_modes = ['home','specify','friends','browsing'];
      if(!Meteor.userId() ) valid_modes = ['home','browsing' ];
      if(mode === null || $.inArray(mode, valid_modes) <=0 )
      {
        mode = 'home';
        localStorage.setItem('mode', mode);
      }
      return mode;
    }
    else
    {
      localStorage.setItem('mode', mode);
      self.debugString("set mode to "+mode);
      if(mode == 'specify')
        Marauder.map.setOptions({draggableCursor:'crosshair'});
      else
        Marauder.map.setOptions({draggableCursor:'default'});
      Session.set('activeModeDescription',new Date().getTime());
    }
  },
  setItems: function(map) {
    var self = this;
    var c = map.getCenter();
    var b = map.getBounds();
    var zoom = map.getZoom();
    var mode = self.mode();
    localStorage.setItem('zoomLevel', zoom);
    localStorage.setItem('center', JSON.stringify(c));
    localStorage.setItem('boundary', JSON.stringify({ne: b.getNorthEast(), sw: b.getSouthWest()}));
    // if(mode != 'specify' && mode != 'friends') self.mode('browsing');
    Session.set('updated', new Date().getTime());
  },
  getUserName: function(friend) {
    // Marauder.debugString(friend);
    if(friend.emails !== undefined && friend.emails.length>0)
      return friend.emails[0].address;
    else
      return friend._id;
  },
  userLatLng: function(location) {
    try {
      if(location !== undefined && google.maps.LatLng !== undefined)
        return new google.maps.LatLng(Marauder.R2D(location.coordinates[1]),Marauder.R2D(location.coordinates[0]));
      else return undefined;
    } catch (e) {
      Marauder.debugString(e);
    }
  },
  bounceMarker: function(id) {
    var self = this;
    if(self.markers.selected)
    {
      self.markers.selected.setAnimation(null);
      self.markers.selected = undefined;
    }
    if(id !== undefined && self.markers.friends[id] !== undefined)
    {
      console.log("bouncing "+id);
      self.markers.selected = self.markers.friends[id];
      self.markers.selected.setAnimation(google.maps.Animation.BOUNCE);
      Meteor.setTimeout(function(){
        self.markers.selected.setAnimation(null);
        self.markers.selected = undefined;
      }, 4000);
    }
  },
  showClickedUser: function(){
      // console.log(this);
      Marauder.markers.selected = this;
      var m = Session.get('message');
      var t = this.getTitle();
      if(m != t)
        Session.set('message', t);
      else
        Session.set('message', '');
      // Marauder.markers.infowindow[user._id].open(Marauder.map, this);
  },
  updateFriends: function(who) {
    var self = this;
    if(self.map !== undefined)
    {
      self.debugString("Marauder.updateFriends from "+who);
      var visibleMarkers = {};
      var uid = Meteor.userId();
      Meteor.users.find().forEach(function(user){
        // skip over myself (should be filtered out on the server)
        if(user._id != uid)
        {
          visibleMarkers[user._id] = true;
          var userName = self.getUserName(user);
          if(userName === undefined) userName = 'unknown';
          // do we have a marker already
          if(self.markers.friends[user._id] === undefined)
          {
            self.debugString('add marker for '+userName);
            var c = self.userLatLng(user.location);
            self.markers.friends[user._id] = new google.maps.Marker({
                position: c,
                animation: google.maps.Animation.DROP,
                draggable: false,
                map: self.map,
                icon: 'friend.png',
                title: userName+' '+user._id
            });
            // if(self.markers.infowindow[user._id] === undefined)
            //   self.markers.infowindow[user._id] = new google.maps.InfoWindow({
            //       content: userName+'<br>'+user._id
            //   });

            google.maps.event.addListener(self.markers.friends[user._id], 'click', self.showClickedUser);
          }
          else
          {
            // self.debugString('update marker for '+userName);
            self.markers.friends[user._id].setPosition(self.userLatLng(user.location));
          }
        }
        else
        {
            if(Marauder.markers.friends[user._id] !== undefined)
            {
                Marauder.markers.friends[user._id].setMap(null);
                delete(Marauder.markers.friends[user._id]);
                self.debugString("Marauder.updateFriends removed myself from friends");
            }
        }
      });

      if(localStorage.getItem('clearInvisibleMarkers') !== null)
      {
        // Marauder.debugString(visibleMarkers);
        for(var f in self.markers.friends)
        {
          if(visibleMarkers[f] === undefined)
          {
            self.markers.friends[f].setMap(null);
            delete(self.markers.friends[f]);
            self.debugString("updateFriends removed "+f);
          }
        }
      }

      if(!uid && self.markers.myself)
        self.markers.myself.setTitle('Myself');
    }
  },
  control: function (controlDiv, map) {
    // Set CSS styles for the DIV containing the control
    // Setting padding to 5 px will offset the control
    // from the edge of the map
    controlDiv.style.padding = '5px';

    // Set CSS for the control border
    var controlUI = document.createElement('div');
    controlUI.style.backgroundColor = 'white';
    controlUI.style.borderStyle = 'solid';
    controlUI.style.borderWidth = '2px';
    controlUI.style.borderColor = '#aaa';
    controlUI.style.cursor = 'pointer';
    controlUI.style.padding = '.2em';
    controlUI.style.textAlign = 'center';
    controlUI.title = 'Click to show the Marauder windows';
    controlDiv.appendChild(controlUI);

    // Set CSS for the control interior
    var controlText = document.createElement('div');
    controlText.style.fontFamily = 'Arial,sans-serif';
    controlText.style.fontSize = '12px';
    controlText.style.paddingLeft = '4px';
    controlText.style.paddingRight = '4px';
    controlText.innerHTML = '<b>Marauders <span id="onlineCount">'+Session.get('onlineCount')+'</span></b>';
    controlText.id = "marauderControlText";
    controlUI.appendChild(controlText);

    // Setup the click event listeners: simply set to fadeIn/Out the canogleOverlayShow
    google.maps.event.addDomListener(controlUI, 'click', function() {
      if($('#overlay').is(':visible'))
      {
        $('#overlay').fadeOut(1000,function(){
          localStorage.setItem('overlay', false);
        });
        $("#marauderControlText").css("color","black");
      }
      else
      {
        $('#overlay').fadeIn(1000, function(){
          localStorage.setItem('overlay', true);
        });
        $("#marauderControlText").css("color","#aaa");
      }
    });
  },
  moveMap2Myself: function(coordinates) {
    var self = this;
    coordinates = coordinates || self.markers.myself.getPosition();
    if(self.markers.myself)
    {
      // self.moveMap2MyselfRunning = true;
      console.log('move map to myself');
      self.map.setCenter( coordinates );
      self.map.setZoom(12);
    }
  },
  updateMyself: function(coordinates, timestamp) {
    var self = this;
    var title = 'Myself ';
    if(coordinates === undefined) coordinates = self.markers.myself.getPosition();
    if(timestamp === undefined) timestamp = new Date().getTime();
    if(Meteor.user())
    {
      var user = Meteor.user();
      var uid = Meteor.userId();
      var coords = [ Marauder.D2R(coordinates.lng()), Marauder.D2R(coordinates.lat()) ];
      Meteor.users.update({_id: uid},{
        $set:{
          timestamp: timestamp,
          mode: self.mode(),
          location: {
            type: 'Point',
            coordinates: coords
          }
        }
      });

      title+=uid;
    }
    else
    {
      title+=' anon';
    }
    localStorage.setItem('timestamp', timestamp);
    if(self.markers.myself)
    {
      self.markers.myself.setPosition(coordinates);
      self.markers.myself.setOptions({title: title});
    }
    else
    {
      self.markers.myself = new google.maps.Marker({
        position: coordinates,
        animation: google.maps.Animation.DROP,
        draggable: false,
        map: Marauder.map,
        icon: 'myself.png',
        title: title
      });

      google.maps.event.addListener(Marauder.markers.myself, 'dragend', function(event) {
          Marauder.updateMyself(event.latLng, new Date().getTime());
      });
    }

  },
  updateLocation: function () {
    var self = this;
    var tracking = localStorage.getItem('tracking');
    if(Meteor.userId() === null || tracking == "checked")
    {
      console.log("updateLocation tracking "+tracking);
      if(navigator.geolocation && self.mode() != 'specify')
      {
        navigator.geolocation.getCurrentPosition(function(position) {
          var o = localStorage.getItem('home');
          var t = localStorage.getItem('timestamp');
          if(t != position.timestamp)
          {
            var c = new google.maps.LatLng(position.coords.latitude,position.coords.longitude);
            localStorage.setItem('home', JSON.stringify(c));
            Marauder.debugString('new home '+position.timestamp+' old '+t);
            self.updateMyself(c, position.timestamp);
          }
        }, function() {
          // San Francisco
          Marauder.debugString('getCurrentPosition failed, setting San Francisco');
          var sf = new google.maps.LatLng( 37.998867291789836, -122.20487600000001 );
          self.updateMyself(sf, new Date().getTime());
          console.log(position);
        });
      }
      // Browser doesn't support Geolocation
      else
      {
        // San Francisco
        Session.set('message','Browser does not suppport Geolocation');
        self.updateMyself(new google.maps.LatLng( 37.998867291789836, -122.20487600000001 ) , new Date().getTime());
      }
    }
  }
});

Marauder.debugString('Marauder extended: '+Marauder.timestamp);

Template.marauder.rendered = function() {
  Marauder.debugString('Template.marauder.rendered');

  var center = localStorage.getItem('center');
  var home = localStorage.getItem('home');
  var weHaveNoCenter = false;

  if(Marauder.map === undefined)
  {
    var zoom = localStorage.getItem('zoomLevel');
    if(zoom === null) zoom = 12;else zoom=parseInt(zoom,10);
    if(zoom < 2) zoom = 12;
    if(center === null)
    {
      center = new google.maps.LatLng( 37.7701371389949, -122.41666322381593 );
      // we have no center, so make sure we go into track mode
      Marauder.debugString('we have no center');
      weHaveNoCenter = true;
    }
    else
    {
      var c = JSON.parse(center);
      center = new google.maps.LatLng( c['jb'], c['kb'] );
    }
    if(home === null) home = center;
    else {
      var h = JSON.parse(home);
      home = new google.maps.LatLng( h['jb'], h['kb'] );
    }

    var mapOptions = {
          zoom: zoom,
          center: center,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
          streetViewControl: false,
          disableDefaultUI: true,
          zoomControlOptions: {
            style: google.maps.ZoomControlStyle.DEFAULT
          }
    };

    Marauder.setMap( new google.maps.Map(document.getElementById('marauder_map'), mapOptions) );

    google.maps.event.addListener(Marauder.map, 'dragend', function() {
        // 3 seconds after the center of the map has changed, pan back to the marker.
        Marauder.debugString("dragend");
        Marauder.setItems(this);
        if( Marauder.mode() == 'home') Marauder.mode('browsing');
    });

    google.maps.event.addListener(Marauder.map, 'zoom_changed', function() {
        Marauder.debugString("zoomed "+ zoom);
        Marauder.setItems(this);
        if( Marauder.mode() == 'home') Marauder.mode('browsing');
    });

    google.maps.event.addListener(Marauder.map, 'idle', function() {
      if(weHaveNoCenter)
      {
        $('div.button-toggles input.home').click();
      }
    });

    google.maps.event.addListener(Marauder.map, 'click', function(event) {
      if(Marauder.mode() == 'specify')
      {
        Marauder.updateMyself(event.latLng, new Date().getTime());
      }
    });

    var controlDiv = document.createElement('div');
    var control = new Marauder.control(controlDiv, Marauder.map);
    controlDiv.index = 1;

    Marauder.map.controls[google.maps.ControlPosition.TOP_RIGHT].push(controlDiv);

    Marauder.updateMyself(home, new Date().getTime());

    if(Marauder.mode() == 'specify')
      Marauder.markers.myself.setOptions({draggable: true});
    if(Marauder.mode() == 'home')
      Marauder.updateLocation();
  }
  else
  {
    var c1 = JSON.parse(center);
    if(c1 !== null && c1['jb'] !== undefined && Marauder.map !== null)
      Marauder.map.setCenter( new google.maps.LatLng( c1['jb'], c1['kb'] ) );
    else Marauder.updateLocation();
    if(Marauder.mode() == 'home') Marauder.moveMap2Myself();
  }

  Marauder.updateFriends('Template.marauder.rendered');

  // Marauder.debugString(this);
  var user = Meteor.user();
  if(false && user !== null)
  {
    try {
      if(user.username !== 'admin')
      {
        // Marauder.debugString(user.emails[0]);
        if(user.emails[0].verified)
        {
          return "Welcome to Marauder "+user.username;
        }
        else
        {
            if( user.services.email.verificationTokens.length === 0 )
            {
              Meteor.call('sendVerificationEmail', Meteor.userId(), user.emails[0].address);
            }
            Meteor.logout();
            alert('Your account has not been verified yet, we sent you an e-mail to '+user.emails[0].address);
          return user.emails[0].address+' is not verified';
        }
      }
    } catch(e) {
      Marauder.debugString(e);
    }
  }
};

Template.marauder.debugActive = function() {
  var a = Session.get('debug');
  return a ? "active" : "";
};

Template.marauder.friends = function() {
  var updated = Session.get('updated');
  Marauder.debugString('Template.marauder.friends');
  Meteor.call('onlineFriends', Meteor.userId(), function(err, friends){
    if(err === undefined && friends.length>0)
    {
      Session.set('friends', friends);
      // Marauder.updateFriends('Template.marauder.friends');
    }
  });

  return Session.get('friends');
};

Template.buttons.message = function() {
  var x = Session.get('activeModeDescription');
  return Session.get('message');
};

// Template.buttons.rendered = function() {
//   return Session.get('activeModeDescription');
// };

Template.buttons.helpers({
  activeModeDescription: function() {
    var mode = Marauder.mode();
    var desc = mode+' is an unknown mode';
    switch(mode)
    {
      case 'home':
        desc = 'Using your browser\'s/device\'s location to have marauder track you';
      break;
      case 'friends':
        desc = 'Showing all your online friends on the map';
      break;
      case 'browsing':
        desc = 'Browsing around on the map';
      break;
      case 'specify':
        desc = 'Drag your marker to where you want it to appear for your friends to see, or click on the map to set your location';
      break;
    }
    return desc;
  }
});

Template.onlineCounter.onlineCount = function() {
  Meteor.call('onlineFriends', Meteor.userId(), function(err, friends){
    if(err === undefined)
    {
      Session.set('friends', friends);
      Session.set('onlineCount', friends.length);
      // console.log(friends.length);
      // Marauder.updateFriends('onlineCount');
    }
  });

  return Session.get('onlineCount');
};
//
// we use the onlineCounter to update Locations online status field
//
Template.onlineCounter.rendered = function() {
  Marauder.debugString('Template.onlineCounter.rendered');
  $('#onlineCount').html(Session.get('onlineCount'));
};

// Meteor.Presence.state = function() {
//   //
//   // this is being called every second, or Meteor.Presence.PRESENCE_INTERVAL
//   //
//   if(Meteor.userId())
//   {
//     Marauder.updateLocation();
//     // Marauder.debugString("Meteor.Presence.state");
//   }
//    if(Marauder.mode() == 'home')       Marauder.map.setCenter(Marauder.markers.myself.getPosition());
//   return {
//     online: Meteor.userId() !== null
//     //,currentRoomId: Session.get('currentRoomId');
//   };
// };

Handlebars.registerHelper('mode', function(button) {
  return Marauder.mode() == button ? 'active' : '';
});

Handlebars.registerHelper('checked', function(e){
    var c = localStorage.getItem(e);
    console.log("checked "+e+"="+c);
    return c == "checked" ? "checked" : "";
});

Handlebars.registerHelper('display_state', function(){
  var updated = Session.get('updated');
  var display = 'block';
  var o = localStorage.getItem('overlay');
  if(o === null)
  {
    $("#marauderControlText").css("color","#aaa");
    localStorage.setItem('overlay', true);
  } else {
    if(o === 'false')
    {
      display = 'none';
    } else
      $("#marauderControlText").css("color","#aaa");
  }
  Marauder.debugString('Handlebars.registerHelper.display_state '+display);
  return display;
});

Handlebars.registerHelper('email', function(user) {
  return user.emails[0].address;
});

Template.marauder.events({
  'click a.marauder-hint': function(e, tmpl) {
    e.preventDefault();
    $('#overlay').fadeOut(1000,function(){
      localStorage.setItem('overlay', false);
    });
    $("#marauderControlText").css("color","black");
  },
  'mouseover a.marauder-hint' : function(e, tmpl) {
    $("#marauderControlText").css({fontSize:"50px", padding:"10px"});
  },
  'mouseout a.marauder-hint' : function(e, tmpl) {
    $("#marauderControlText").css({fontSize:"12px", padding:"0px"});
  },
  'click a.debug': function(e, tmpl) {
    e.preventDefault();
    Marauder.debug = !Marauder.debug;
    Session.set('debug', Marauder.debug);
  },
  'click a.showuserlocation': function(e,tmpl) {
    e.preventDefault();
    Meteor.call('locateUser', e.target.id, function(err,user) {
      if(err === undefined)
      {
        Marauder.mode('browsing');
        var c = Marauder.userLatLng(user.location);
        // if(Marauder.markers.friends[e.target.id] === undefined)
        // {
        //   Marauder.markers.friends[e.target.id] = new google.maps.Marker({
        //       position: c,
        //       animation: google.maps.Animation.DROP,
        //       draggable: false,
        //       map: Marauder.map,
        //       icon: 'friend.png',
        //       title: user.emails[0].address+' '+e.target.id
        //   });
        // }
        Marauder.map.setCenter(c);
        // Marauder.setItems(Marauder.map);
        Marauder.map.setZoom(14);
        Marauder.bounceMarker(e.target.id);
        Session.set('updated', new Date().getTime());
        // Marauder.updateFriends('showuserlocation');
      }
      else Marauder.debugString(err);
    });
  },
  'click a.updateFriends': function(e, templ) {
    e.preventDefault();
    Meteor.call('onlineFriends', Meteor.userId(), function(err, friends){
      if(err === undefined)
      {
        Session.set('friends', friends);
        Session.set('updated', new Date().getTime());
        Marauder.updateFriends('button '+friends.length);
      }
      else Session.set('message',err);
    });
  }
});

Template.buttons.events({
  'click input.tracking': function(e, tmpl) {
    var c = $(e.target).attr("checked");
    localStorage.setItem("tracking", c === undefined ? null : c );
  },
  'click button.friends': function(e,tmpl) {
    Marauder.mode('friends');
    Marauder.markers.myself.setOptions({draggable: false});
    Meteor.call('onlineFriends', Meteor.userId(), function(err, friends){
      if(err === undefined && friends.length>0)
      {
        var bounds = new google.maps.LatLngBounds();
        for(var f in friends)
        {
          var friend = friends[f];
          var coordinates = Marauder.userLatLng(friend.location);

          bounds.extend(coordinates);
        }
        // add myself
        bounds.extend(Marauder.markers.myself.getPosition());
        // make the map fit
        Marauder.map.fitBounds(bounds);
        // make sure the new bounds are set so our subscribe picks them up
        Marauder.setItems(Marauder.map);
      }
      else Session.set('message','No friends online');
    });
  },
  'click button.browsing': function(e,tmpl) {
    Marauder.mode('browsing');
    Marauder.markers.myself.setOptions({draggable: false});
  },
  'click button.specify': function(e,tmpl) {
    Marauder.mode('specify');
    Marauder.markers.myself.setOptions({draggable: true});
  },
  'click button.home' : function (e,tmpl) {
    // template data, if any, is available in 'this'
    Marauder.moveMap2Myself();
    Marauder.mode('home');
    Marauder.updateLocation();
  }
});

Deps.autorun(function() {
  var updated = Session.get('updated');
  var onlineCount = Session.get('onlineCount');
  var boundary = localStorage.getItem('boundary');
  // only do this if we have a current position
  if(boundary !== null)
  {
    var b = JSON.parse(boundary);
    // subscribe stories for current position
    Marauder.locationsCursor = Meteor.subscribe('locations', b, function(x){
      Marauder.debugString(Meteor.users.find().count()+' locations subscribed '+new Date().getTime());
      Marauder.updateFriends('locations subscribed');
    });

  } else Marauder.debugString('deps boundary null');
  // subscribe to my own user record
  Meteor.subscribe('userData', function(){
    Marauder.debugString('userData subscribed');
  });
});
//
// now observe changes
//
Meteor.users.find().observeChanges({
  changed: function(id, fields) {
    if(fields.location !== undefined)
    {
      // my own changes do not register here since id == Meteor.userId is
      // not part of markers.friends but markers.myself
      if(Marauder.markers.friends[id] !== undefined)
      {
        Marauder.markers.friends[id].setPosition(Marauder.userLatLng(fields.location));
        Marauder.debugString("observed changed "+id);
      }
    }
  },
  added: function(id, fields) {
    if(fields.location !== undefined)
    {
      // check for myself and update it
      // unfortunately this is not set
      var uid = Meteor.userId();
      if(id == uid)
      {
        Marauder.markers.myself.setTitle('Myself '+id);
      }
      else
      {
          if(Marauder.markers.friends[id] === undefined)
          {
            var userName = fields.emails[0].address;
            if(userName === undefined) userName = 'unknown';
            // Marauder.debugString('add marker for '+user.userName);
            var c = Marauder.userLatLng(fields.location);
            if(c)
            {
              Marauder.markers.friends[id] = new google.maps.Marker({
                  position: c,
                  animation: google.maps.Animation.DROP,
                  draggable: false,
                  map: Marauder.map,
                  icon: 'friend.png',
                  title: userName+' '+id
              });

              google.maps.event.addListener(Marauder.markers.friends[id], 'click', Marauder.showClickedUser);

              Marauder.debugString("observed added "+id);
            }
          }
          else
          {
            Marauder.markers.friends[id].setPosition(Marauder.userLatLng(fields.location));
          }
      }
    }
  },
  removed: function(id) {
    if(Marauder.markers.friends[id] !== undefined)
    {
      Marauder.markers.friends[id].setMap(null);
      delete(Marauder.markers.friends[id]);
      Marauder.debugString("observed removed "+id);
      Session.set('message','');
    }
  }
});
