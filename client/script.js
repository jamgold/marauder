//
// http://google-maps-utility-library-v3.googlecode.com/svn/trunk/markerclusterer/docs/reference.html
// http://mapicons.nicolasmollet.com/category/markers/friends-family
//
var onlineCount = 0;

Session.setDefault('onlineCount', onlineCount);
Session.setDefault('message', '');
Session.setDefault('showModal', false);
Session.setDefault('mode', 'home');
Session.setDefault('loggedIn', false);
Session.setDefault('tracking', false);
Session.setDefault('onlineonly', false);

_.extend(Marauder, {
  debug: localStorage.getItem('debug') == 'true' ? true: false,
  timestamp: new Date(),
  moveMap2MyselfRunning: false,
  mc: null,
  markers: {
    myself: undefined,
    selected: undefined,
    infowindow: {},
    friends: {}
  },
  toggleDebug: function() {
    var self = this;
    self.debug = ! self.debug;
    localStorage.setItem('debug', false);
  },
  setCenter: function(c, caller) {
    caller = caller || "";
    var self = this;
    // console.log(cal1ler+' setCenter '+c);
    self.map.setCenter(c);
  },
  setZoom: function(z) {
    var self = this;
    // console.log('setZoom '+z);
    self.map.setZoom(z);
  },
  activeModeDescription: function(mode) {
    var self = this;
    mode = mode || self.mode();
    var tracking = Session.get('tracking');
    var onlineonly = Session.get('onlineonly') ? '<b>online</b>' : '';
    var desc = mode+' is an unknown mode';
    switch(mode)
    {
      case 'home':
        desc = 'Moved the map to where you are (or where you marker sits)';
        if(tracking)
          desc+= '<br>We will also update your location based on your browser&#39;s geo location';
        else
          desc+= '<br>Drag your marker to where you want it to appear for your friends to see';
      break;
      case 'friends':
        desc = 'Showing all your '+onlineonly+' friends on the map';
        if(!tracking) desc+= '<br>Drag your marker to where you want it to appear for your friends to see';
      break;
      case 'browsing':
        desc = 'Browsing around on the map';
        if(!tracking) desc+= '<br>Drag your marker to where you want it to appear for your friends to see';
        if(!Meteor.userId()) desc+='<br>To see anything you need to login and add friends.';
      break;
      case 'specify':
        desc = 'Drag your marker to where you want it to appear for your friends to see, or click on the map to set your location';
      break;
    }
    return desc;
  },
  mode: function(mode) {
    var self = this;
    if(mode === undefined)
    {
      mode = localStorage.getItem('mode');
      var valid_modes = ['home','specify','friends','browsing'];
      if(!Meteor.userId() ) valid_modes = ['home','browsing' ];
      if(mode === null || $.inArray(mode, valid_modes) < 0 )
      {
        Session.set('message',mode+' invalid '+valid_modes);
        mode = 'home';
        localStorage.setItem('mode', mode);
        Session.set('mode', mode);
        Session.set("activeModeDescription", self.activeModeDescription(mode) );
        self.showModal();
      }
      return mode;
    }
    else
    {
      var oldmode = localStorage.getItem('mode');
      if(oldmode != mode)
      {
        localStorage.setItem('mode', mode);
        self.log("set mode to "+mode);

        if(mode == 'specify')
          Marauder.map.setOptions({draggableCursor:'crosshair'});
        else
          Marauder.map.setOptions({draggableCursor:'default'});

        Session.set('mode', mode);
        Session.set("activeModeDescription", self.activeModeDescription(mode) );
        self.showModal();
      }
    }
  },
  showModal: function() {
    // console.log('show modal');
    Session.set('showModal', true);
  },
  setItems: function(map) {
    var self = this;
    if(!self.moveMap2MyselfRunning)
    {
      var c = map.getCenter();
      var b = map.getBounds();
      var zoom = map.getZoom();
      var mode = self.mode();
      localStorage.setItem('zoomLevel', zoom);
      localStorage.setItem('center', JSON.stringify(c));
      localStorage.setItem('boundary', JSON.stringify({ne: b.getNorthEast(), sw: b.getSouthWest()}));
      // if(mode != 'specify' && mode != 'friends') self.mode('browsing');
      Session.set('updated', new Date().getTime());
    }
  },
  getUserName: function(friend) {
    // Marauder.log(friend);
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
      Marauder.log(e);
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
      self.markers.selected = self.markers.friends[id];
      self.markers.selected.setAnimation(google.maps.Animation.BOUNCE);
      Meteor.setTimeout(function(){
        self.markers.selected.setAnimation(null);
        self.markers.selected = undefined;
      }, 1500);
    }
  },
  showClickedUser: function(){
      Marauder.markers.selected = this;
      // var m = Session.get('message');
      var t = this.getTitle();
      Session.set('message', 'Clicked user '+t+' <button class="btn stalk">Stalk</button>');

      Marauder.showModal();
  },
  updateFriends: function(who) {
    var self = this;
    if(self.map !== undefined)
    {
      self.log("Marauder.updateFriends from "+who);
      var visibleMarkers = {};
      var uid = Meteor.userId();
      var onlineonly = Session.get('onlineonly');
      Meteor.users.find().forEach(function(user){
        // skip over myself (should be filtered out on the server)
        if(user._id != uid)
        {
          if(onlineonly && user.profile && !user.profile.online)
          {

          }
          else
          {
            visibleMarkers[user._id] = true;
            var userName = self.getUserName(user);
            if(userName === undefined) userName = 'unknown';
            // do we have a marker already
            if(self.markers.friends[user._id] === undefined)
            {
              self.log('add marker for '+userName);
              var c = self.userLatLng(user.location);
              self.markers.friends[user._id] = new google.maps.Marker({
                  position: c,
                  animation: google.maps.Animation.DROP,
                  draggable: false,
                  map: self.map,
                  icon: user.profile.online ? 'friend.png' : 'offline.png',
                  title: userName+' '+user._id
              });
              self.mc.addMarker(self.markers.friends[user._id]);
              // if(self.markers.infowindow[user._id] === undefined)
              //   self.markers.infowindow[user._id] = new google.maps.InfoWindow({
              //       content: userName+'<br>'+user._id
              //   });

              google.maps.event.addListener(self.markers.friends[user._id], 'click', self.showClickedUser);
            }
            else
            {
              // self.log('update marker for '+userName);
              self.markers.friends[user._id].setPosition(self.userLatLng(user.location));
              self.markers.friends[user._id].setIcon(user.profile.online ? 'friend.png' : 'offline.png');
            }
          }
        }
        else
        {
            if(self.markers.friends[user._id] !== undefined)
            {
                self.mc.removeMarker(self.markers.friends[user._id]);
                self.markers.friends[user._id].setMap(null);
                delete(self.markers.friends[user._id]);
                self.log("Marauder.updateFriends removed myself from friends");
            }
        }
      });

      if(localStorage.getItem('clearInvisibleMarkers') !== null)
      {
        // Marauder.log(visibleMarkers);
        for(var f in self.markers.friends)
        {
          if(visibleMarkers[f] === undefined)
          {
            self.mc.removeMarker(self.markers.friends[f]);
            self.markers.friends[f].setMap(null);
            delete(self.markers.friends[f]);
            self.log("updateFriends removed "+f);
          }
        }
      }

      if(!uid && self.markers.myself)
        self.markers.myself.setTitle('Myself');
    }
  },
  updateFriendsList: function(onlineonly) {
    // console.log('updateFriendsList');
    Meteor.call('myFriends', Meteor.userId(), onlineonly, function(err, friends){
      if(err === undefined)
      {
        Session.set('friends', friends);
        Session.set('onlineCount', friends.length);
        // Marauder.updateFriends('Template.friends.friends');
      }
      else
      {
        console.log(err);
      }
    });
  },
  marauderMapControl: function (controlDiv, map) {
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
    controlText.innerHTML = '<b><span id="onlineCount">'+Session.get('onlineCount')+'</span> Marauders</b>';
    controlText.id = "marauderControlText";
    controlUI.appendChild(controlText);

    // Setup the click event listeners: simply set to fadeIn/Out the canogleOverlayShow
    google.maps.event.addDomListener(controlUI, 'click', function() {
      if($('#overlay').is(':visible'))
      {
        $('#overlay').hide();
        localStorage.setItem('overlay', false);
        $("#marauderControlText").css("color","black");
      }
      else
      {
        $('#overlay').show();
        localStorage.setItem('overlay', true);
        $("#marauderControlText").css("color","#aaa");
      }
    });
  },
  moveMap2Myself: function(coordinates) {
    var self = this;
    coordinates = coordinates || self.markers.myself.getPosition();
    if(self.markers.myself)
    {
      self.moveMap2MyselfRunning = true;
      self.setCenter( coordinates , 'moveMap2Myself');
      self.setZoom(18);
      self.moveMap2MyselfRunning = false;
    }
  },
  updateMyMarker: function(coordinates, title) {
    var self = this;
    if(self.markers.myself)
    {
      self.markers.myself.setPosition(coordinates);
      self.markers.myself.setOptions({title: title});
    }
    else if(google !== undefined)
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
        Marauder.mode('browsing');
        Marauder.updateMyself(event.latLng, new Date().getTime());
      });

      self.mc.addMarker(self.markers.myself);
    }
    if(self.markers.myself !== undefined)
    {
      if(Session.get('tracking'))
        self.markers.myself.setOptions({draggable: false});
      else
        self.markers.myself.setOptions({draggable: true});

      if(!Meteor.user())
      {
        self.moveMap2Myself(self.markers.myself.getPosition());
      }
    }
  },
  updateMyself: function(coordinates, timestamp) {
    var self = this;
    var title = 'Myself ';
    var user = Meteor.user();
    if(coordinates === undefined) coordinates = self.markers.myself.getPosition();
    if(timestamp === undefined) timestamp = new Date().getTime();
    if(user)
    {
      var uid = user._id;
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

    self.updateMyMarker(coordinates, title);
  },
  updateLocation: function () {
    var self = this;
    var tracking = Session.get('tracking');
    if(Meteor.userId() === null || tracking)
    {
      self.log('getting geo location');
      if(navigator.geolocation)
      {
        navigator.geolocation.getCurrentPosition(function(position) {
          var o = localStorage.getItem('home');
          var t = localStorage.getItem('timestamp');
          if(t != position.timestamp)
          {
            var c = new google.maps.LatLng(position.coords.latitude,position.coords.longitude);
            localStorage.setItem('home', JSON.stringify(c));
            Marauder.log('new home '+position.timestamp+' old '+t);
            self.updateMyself(c, position.timestamp);
          }
        }, function() {
          // San Francisco
          Session.set('message','getCurrentPosition failed, setting San Francisco');
          Marauder.showModal();
          var sf = new google.maps.LatLng( 37.998867291789836, -122.20487600000001 );
          self.updateMyself(sf, new Date().getTime());
        });
      }
      // Browser doesn't support Geolocation
      else
      {
        // San Francisco
        Session.set('message','Browser does not suppport Geolocation');
        Marauder.showModal();
        self.updateMyself(new google.maps.LatLng( 37.998867291789836, -122.20487600000001 ) , new Date().getTime());
      }
    }
  },
  initialize: function() {
    var self = this;
    var center = localStorage.getItem('center');
    var home = localStorage.getItem('home');
    var zoom = localStorage.getItem('zoomLevel');
    var weHaveNoCenter = false;
    if(zoom === null) zoom = 12;else zoom=parseInt(zoom,10);
    if(zoom < 2) zoom = 12;
    if(!center)
    {
      center = new google.maps.LatLng( 37.7701371389949, -122.41666322381593 );
      // we have no center, so make sure we go into track mode
      self.log('we have no center');
      weHaveNoCenter = true;
    }
    else
    {
      try{
        var c = JSON.parse(center);
        center = new google.maps.LatLng( c['jb'], c['kb'] );
      } catch(e) {
        center = new google.maps.LatLng( 37.7701371389949, -122.41666322381593 );
      }
    }
    if(!home) home = center;
    else {
      try {
        var h = JSON.parse(home);
        home = new google.maps.LatLng( h['jb'], h['kb'] );
      } catch(e) {
        home = center;
      }
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

    self.setMap( new google.maps.Map(document.getElementById('marauder_map'), mapOptions) );

    var styles = [{
      url: 'group.png',
      height: 35,
      width: 35,
      opt_anchor: [16, 0],
      opt_textColor: '#ff00ff',
      opt_textSize: 10
    }];

    self.mc = new MarkerClusterer(self.map,[], {gridSize: 50, maxZoom: 17, styles: styles});

    google.maps.event.addListener(self.map, 'dragend', function() {
        // 3 seconds after the center of the map has changed, pan back to the marker.
        self.log("dragend");
        if(!self.moveMap2MyselfRunning)
        {
          var mode = self.mode();
          self.setItems(this);
          if( mode == 'home' || mode == 'friends') self.mode('browsing');
        }
    });

    google.maps.event.addListener(self.map, 'zoom_changed', function() {
        self.log("zoomed "+ zoom);
        if(! self.moveMap2MyselfRunning)
        {
          var mode = self.mode();
          self.setItems(this);
          if( mode == 'home' || mode == 'friends' ) self.mode('browsing');
        }
    });

    google.maps.event.addListener(self.map, 'idle', function() {
      if(weHaveNoCenter)
      {
        $('div.button-toggles input.home').click();
      }
    });

    // google.maps.event.addListener(self.map, 'click', function(event) {
    //   if(!Session.get('tracking') && Marauder.mode() == 'browsing')
    //   {
    //     self.updateMyself(event.latLng, new Date().getTime());
    //     self.mc.repaint();
    //   }
    // });

    var controlDiv = document.createElement('div');
    var control = new self.marauderMapControl(controlDiv, self.map);
    controlDiv.index = 1;

    self.map.controls[google.maps.ControlPosition.TOP_RIGHT].push(controlDiv);

    self.updateMyself(home, new Date().getTime());

    if(self.mode() == 'home')
      self.updateLocation();
  }
});

Marauder.log('Marauder extended: '+Marauder.timestamp);

Template.marauder.loggedIn = function() {
  //
  Marauder.log('Template.marauder.loggedIn');
  return Session.get('loggedIn');
};

Template.buttons.currentmode = function() {
  //
  return Session.get('mode');
};

Template.marauder.showModal = function() {
  //
  return Session.get('showModal');
};

Template.marauder.rendered = function() {
  var user = Meteor.user();

  if(Marauder.map === undefined)
  {
    Marauder.log('Template.marauder.rendered initialize');

    Marauder.initialize();
    Marauder.updateFriends('Template.marauder.rendered');
  }
  else
  {
    Marauder.log('Template.marauder.rendered rerun');

    if(Session.get('tracking'))
      Marauder.markers.myself.setOptions({draggable: false});
    else
      Marauder.markers.myself.setOptions({draggable: true});

    // var c1 = JSON.parse(center);
    // if(c1 !== null && c1['jb'] !== undefined && Marauder.map !== null)
    //   Marauder.setCenter( new google.maps.LatLng( c1['jb'], c1['kb'] ), 'marauder.render' );
    // else Marauder.updateLocation();
    if(Marauder.mode() == 'home') Marauder.moveMap2Myself();
  }
  // Marauder.updateFriends('Template.marauder.rendered');
  // Marauder.log(this);
  // if(false && user !== null)
  // {
  //   try {
  //     if(user.username !== 'admin')
  //     {
  //       // Marauder.log(user.emails[0]);
  //       if(user.emails[0].verified)
  //       {
  //         return "Welcome to Marauder "+user.username;
  //       }
  //       else
  //       {
  //           if( user.services.email.verificationTokens.length === 0 )
  //           {
  //             Meteor.call('sendVerificationEmail', Meteor.userId(), user.emails[0].address);
  //           }
  //           Meteor.logout();
  //           alert('Your account has not been verified yet, we sent you an e-mail to '+user.emails[0].address);
  //         return user.emails[0].address+' is not verified';
  //       }
  //     }
  //   } catch(e) {
  //     Marauder.log(e);
  //   }
  // }
};

Template.friends.friends = function() {
  var updated = Session.get('updated');
  var onlineonly = Session.get('onlineonly');
  Marauder.log('Template.friends.friends');
  return Session.get('friends');
};

Template.friends.message = function() {
  //
  return Session.get('friendRequestMessage');
};

Template.friends.requests = function() {
  //
  return Requests.find();
};

Template.modal.message = function() {
  var t = Session.get("tracking");
  var x = Session.get('activeModeDescription');
  return Session.get('message');
};

Template.modal.activeModeDescription = function() {
  //
  return Session.get('activeModeDescription');
};

Template.onlineCounter.onlineCount = function() {
  //
  return Session.get('onlineCount');
};
//
// we use the onlineCounter to update Locations online status field
//
Template.onlineCounter.rendered = function() {
  Marauder.log('Template.onlineCounter.rendered');
  $('#onlineCount').html(Session.get('onlineCount'));
};

Template.marauder.events({
  'click button.stalk': function(e, tmpl) {
    if(Marauder.markers.selected)
    {
      Marauder.markers.myself.setPosition( Marauder.markers.selected.getPosition() );
      Marauder.mc.redraw();
    }
  },
  'click a.marauder-hint, click #overlay button.close': function(e, tmpl) {
    e.preventDefault();
    $('#overlay').hide();
    localStorage.setItem('overlay', false);
    $("#marauderControlText").css("color","black");
  },
  'click modal button.close': function(e, tmpl) {
    Session.set('showModal', false);
    Session.set('message','');
  },
  'click input.onlineonly': function(e, tmpl) {
    Session.set('onlineonly', !Session.get('onlineonly'));
    Session.set("activeModeDescription", Marauder.activeModeDescription() );
    Marauder.updateFriendsList(Session.get('onlineonly'));
  },
  'mouseover a.marauder-hint' : function(e, tmpl) {
    $("#marauderControlText").css({fontSize:"50px", padding:"10px"});
  },
  'mouseout a.marauder-hint' : function(e, tmpl) {
    $("#marauderControlText").css({fontSize:"12px", padding:"0px"});
  },
  'click a.removefriendship': function(e, tmpl) {
    e.preventDefault();
    Meteor.call('removeFriendship', e.target.id, function(err, res){
      if(err === undefined)
      {
        Session.set('updated', new Date().getTime());
        Marauder.updateFriendsList(Session.get('onlineonly'));
      }
      else Session.set('friendRequestMessage', err.message);
    });
  },
  'change input.friend-request': function(e, tmpl) {
    e.preventDefault();
    Meteor.call('friendRequest', e.target.value, function(err, res){
      if(err)
      {
        Session.set('friendRequestMessage', err.message);
      }
      else
      {
        Session.set('friendRequestMessage', '');
        $(e.target).val('');
      }
    });
  },
  'click a.approverequest': function(e, tmpl) {
    e.preventDefault();
    Meteor.call('approveRequest', e.target.id, function(err, res){
      if(err) {
        Session.set('friendRequestMessage', err.message);
      }
      else
      {
        Requests.remove(e.target.id);
        Session.set('friendRequestMessage', '');
        Session.set('updated', new Date().getTime());
        Marauder.updateFriendsList(Session.get('onlineonly'));
      }
    });
  },
  'click a.removerequest': function(e, tmpl) {
    e.preventDefault();
    Requests.remove({_id: e.target.id});
    Session.set('updated', new Date().getTime());
    Marauder.updateFriendsList(Session.get('onlineonly'));
  },
  'click span.error': function(e, tmpl) {
    e.preventDefault();
    Session.set('friendRequestMessage', '');
  },
  'click a.showuserlocation': function(e,tmpl) {
    e.preventDefault();
    Marauder.mode('browsing');
    Meteor.call('locateUser', e.target.id, function(err,user) {
      if(err === undefined)
      {
        var c = Marauder.userLatLng(user.location);
        var b = Marauder.map.getBounds();
        // determine if the the location is already on the map
        if(! b.contains(c))
        {
          Marauder.setCenter(c, 'locateUser');
          Marauder.setItems(Marauder.map);
        }
        else
        {
          Marauder.log(user._id+' already on the map');
        }
        // check the zoomlevel
        if(Marauder.map.getZoom()<20)
          Marauder.setZoom(21);

        Marauder.bounceMarker(e.target.id);

        Session.set('updated', new Date().getTime());
      }
      else
      {
        Marauder.log(err);
        Session.set('message', err);
        Marauder.showModal();
      }
    });
  },
  'click a.updateFriends': function(e, templ) {
    var onlineonly = Session.get('onlineonly');
    e.preventDefault();
    Marauder.updateFriendsList(onlineonly);
    Marauder.updateFriends('button');
  }
});

Template.buttons.events({
  'click span.error': function(e, tmpl) {
    Session.set('message', '');
  },
  'click input.tracking': function(e, tmpl) {
    var c = $(e.target).attr("checked");
    Session.set("tracking", c ? true : false );
    if(c)
    {
      Marauder.markers.myself.setOptions({draggable: false});
      Marauder.updateLocation();
    }
    else
      Marauder.markers.myself.setOptions({draggable: true});
    Session.set('activeModeDescription', Marauder.activeModeDescription());
  },
  'click button.friends': function(e,tmpl) {
    var onlineonly = Session.get('onlineonly');
    Marauder.mode('friends');
    Marauder.markers.myself.setOptions({draggable: false});
    Meteor.call('myFriends', Meteor.userId(), onlineonly, function(err, friends){
      if(err === undefined && friends.length>0)
      {
        Marauder.moveMap2MyselfRunning = true;
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
        // update friends
        // Marauder.updateFriends('myFriends');
        Marauder.moveMap2MyselfRunning = false;
        Marauder.setItems(Marauder.map);
      }
      else Session.set('message','No friends online');
    });
    Marauder.showModal();
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
    Marauder.mode('home');
    Marauder.moveMap2Myself();
    Marauder.updateLocation();
  }
});

//
// observe changes
//
Meteor.users.find().observeChanges({
  changed: function(id, fields) {
    // if we have a location field, add to markers if it doesn't exist yet
    Marauder.log("observed users changed "+id);
    if(fields.location !== undefined)
    {
      // my own changes do not register here since id == Meteor.userId is
      // not part of markers.friends but markers.myself
      if(Marauder.markers.friends[id] !== undefined)
      {
        Marauder.markers.friends[id].setPosition(Marauder.userLatLng(fields.location));
        if(fields.profile)
        Marauder.markers.friends[id].setIcon(fields.profile.online ? 'friend.png' : 'offline.png');
      }
    }
    // did the profile.online change
    if(fields.profile !== undefined)
    {
      if(Marauder.markers.friends[id] !== undefined)
      {
        // Marauder.log(fields);
        Marauder.markers.friends[id].setIcon(fields.profile.online ? 'friend.png' : 'offline.png');
      }
      // someone's online status changed
      // console.log(fields.profile);
      Marauder.updateFriendsList(Session.get('onlineonly'));
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
            // Marauder.log('add marker for '+user.userName);
            var c = Marauder.userLatLng(fields.location);
            if(c)
            {
              Marauder.markers.friends[id] = new google.maps.Marker({
                  position: c,
                  animation: google.maps.Animation.DROP,
                  draggable: false,
                  map: Marauder.map,
                  icon: fields.profile.online ? 'friend.png' : 'offline.png',
                  title: userName+' '+id
              });

              google.maps.event.addListener(Marauder.markers.friends[id], 'click', Marauder.showClickedUser);

              Marauder.mc.addMarker(Marauder.markers.friends[id]);

              Marauder.log("observed users added "+id);

              Session.set('updated', new Date().getTime());
            }
          }
          else
          {
            Marauder.markers.friends[id].setPosition(Marauder.userLatLng(fields.location));
            Marauder.markers.friends[id].setIcon(fields.profile.online ? 'friend.png' : 'offline.png');
          }
      }
    }
    else
    {
      // Marauder.updateFriendsList(Session.get('onlineonly'));
      Marauder.log('observed users added '+id+' fields');
      Marauder.log(fields);
    }
  },
  removed: function(id) {
    if(Marauder.markers.friends[id] !== undefined)
    {
      Marauder.mc.removeMarker(Marauder.markers.friends[id]);
      Marauder.markers.friends[id].setMap(null);
      delete(Marauder.markers.friends[id]);
      Marauder.log("observed users removed "+id);
      Session.set('message','');
      Session.set('updated', new Date().getTime());
    }
    Marauder.updateFriendsList(Session.get('onlineonly'));
  }
});
Requests.find().observeChanges({
  changed: function(id, fields) {
    // console.log('request changed '+id);
  },
  added: function(id, fields) {
    // console.log('request added '+id);
    Marauder.updateFriendsList(Session.get('onlineonly'));
  },
  removed: function(id) {
    // console.log('request removed '+id);
    Marauder.updateFriendsList(Session.get('onlineonly'));
  }
});

Meteor.startup(function(){
});
Deps.autorun(function() {
  var friends = Session.get('friends');
  var updated = Session.get('updated');
  var onlineonly = Session.get('onlineonly');
  var onlineCount = Session.get('onlineCount');
  var user = Meteor.user();
  // only do this if we have a current position
  // subscribe to my own user record
  Meteor.subscribe('userData', function(){
    Marauder.log('userData subscribed');
  });

  if(user)
  {
    if(Session.get('loggedIn') === false)
    {
      Session.set('loggedIn', true);
      Marauder.log('autorun loggedIn true');
      var c = Marauder.userLatLng(user.location);
      localStorage.setItem('home', JSON.stringify(c));
      Marauder.updateMyMarker(c, 'Myself '+user._id);
      // Marauder.updateFriendsList(Session.get('onlineonly'));
    }

    var boundary = localStorage.getItem('boundary');
    if(boundary)
    {
      // console.log(boundary);
      var b = JSON.parse(boundary);
      // subscribe stories for current position
      Marauder.locationsCursor = Meteor.subscribe('locations', b, onlineonly, function(x){
        Marauder.log(Meteor.users.find().count()+' locations subscribed '+new Date().getTime());
        Marauder.updateFriends('locations subscribed');
        // Marauder.updateFriendsList(onlineonly);
      });

    } else Marauder.log('deps boundary null');

    Meteor.subscribe('requests', function(){
      Marauder.log('friend requests subscribed');
      Marauder.updateFriendsList(onlineonly);
    });

    Meteor.subscribe('friends', function(){
      Marauder.log('friends subscribed');
      Marauder.updateFriendsList(onlineonly);
    });
  }
  else
  {
    if(Session.get('loggedIn') === true)
    {
      Session.set('loggedIn', false);
      Marauder.log('autorun loggedIn false');
      Session.set('updated', new Date().getTime());
    }
    if(!Session.get('tracking'))
      Session.set('tracking', true);
  }
});
