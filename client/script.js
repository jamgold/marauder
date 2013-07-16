//
// http://google-maps-utility-library-v3.googlecode.com/svn/trunk/markerclusterer/docs/reference.html
// http://mapicons.nicolasmollet.com/category/markers/friends-family
// http://developer.apple.com/library/ios/#documentation/AppleApplications/Reference/SafariWebContent/GettingGeographicalLocations/GettingGeographicalLocations.html#//apple_ref/doc/uid/TP40002051-CH5-SW2
//
var onlineCount = 0;

Session.setDefault('onlineCount', onlineCount);
Session.setDefault('message', '');
Session.setDefault('userCount', 0);
Session.setDefault('showModal', false);
Session.setDefault('mode', 'home');
Session.setDefault('loggedIn', false);
Session.setDefault('tracking', false);
Session.setDefault('onlineonly', false);
Session.setDefault('friendRequestBox', false);
Session.setDefault('overlay', true);

_.extend(Marauder, {
  watchid: undefined,
  timestamp: new Date(),
  moveMap2MyselfRunning: false,
  mc: null,
  markers: {
    myself: undefined,
    selected: undefined,
    friends: {}
  },
  conf: function(key, val) {
    var self = this;
    if(val === undefined)
    {
      return self.config[key];
    }
    else
    {
      self.config[key] = val;
      self.configSave(self.map);
    }
  },
  toggleDebug: function() {
    var self = this;
    self.conf('debug', !self.config.debug);
  },
  toggleOverlay: function(visible) {
    var self = this;
    visible = visible || null;
    var v = $('#overlay').is(':visible');
    if(visible) v = false;
    if(v)
    {
      $('#overlay').hide();
      $("#marauderControlText").css("color","black");
      self.conf('overlay', false);
    }
    else
    {
      $('#overlay').show();
      $("#marauderControlText").css("color","#aaa");
      self.conf('overlay', true);
    }
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
      mode = self.config.mode;
      var valid_modes = ['home','specify','friends','browsing'];
      if(!Meteor.userId() ) valid_modes = ['home','browsing' ];
      if(mode === null || $.inArray(mode, valid_modes) < 0 )
      {
        Session.set('message',mode+' invalid '+valid_modes);
        mode = 'home';
        self.conf('mode', mode);
        Session.set('mode', mode);
        Session.set("activeModeDescription", self.activeModeDescription(mode) );
        self.showModal();
      }
      return mode;
    }
    else
    {
      var oldmode = self.config.mode;
      if(oldmode != mode)
      {
        self.conf('mode', mode);
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
    var self = this;
    // console.log('show modal');
    Session.set('showModal', true);
  },
  hideModal: function() {
    var self = this;
    // console.log('show modal');
    Session.set('showModal', false);
  },
  configSave: function(map) {
    var self = this;
    if(map !== undefined && !self.moveMap2MyselfRunning)
    {
      self.config.mode = self.mode();
      self.config.zoom = map.getZoom();
      self.config.center = map.getCenter();
      var b = map.getBounds();
      if(b)
      {
        self.config.boundary = {ne: b.getNorthEast(), sw: b.getSouthWest()};
      }
      self.config.tracking = Session.get('tracking');
      self.config.onlineonly = Session.get('onlineonly');

      localStorage.setItem('marauder', JSON.stringify(self.config));
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
      var msg = 'Clicked user '+t;
      if(!Session.get('tracking'))
        msg+=' <button class="btn stalk">Stalk</button>';
      Session.set('message', msg);

      Marauder.showModal();
  },
  updateMarkers: function(who) {
    var self = this;
    if(self.map !== undefined)
    {
      self.log("Marauder.updateMarkers from "+who);
      var visibleMarkers = {};
      var uid = Meteor.userId();
      var onlineonly = Session.get('onlineonly');
      var query = onlineonly ? {"profile.online": true} : {};
      var b = self.map.getBounds();
      // don't even bother if we don't have bounds
      if(b !== undefined)
      {
        Meteor.users.find(query).forEach(function(user){
          // skip over myself (should be filtered out on the server)
          if(user._id != uid)
          {
            var c = self.userLatLng(user.location);
            // only add the marker if it is on the map
            if( b.contains(c) )
            {
                  visibleMarkers[user._id] = true;
                  var userName = self.getUserName(user);
                  if(userName === undefined) userName = 'unknown';
                  // do we have a marker already
                  if(self.markers.friends[user._id] === undefined)
                  {
                    self.log('add marker for '+userName);
                    self.markers.friends[user._id] = self.createMarker(c,userName, user.profile.online ? 'friend.png' : 'offline.png');
                    self.mc.addMarker(self.markers.friends[user._id]);

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
              // check if I myself are in the friends markers and remvoe
              //
              if(self.markers.friends[user._id] !== undefined)
              {
                  self.mc.removeMarker(self.markers.friends[user._id]);
                  self.markers.friends[user._id].setMap(null);
                  delete(self.markers.friends[user._id]);
                  self.log("Marauder.updateMarkers removed myself from friends");
              }
            }
        });
      }
      //
      // remove all markers not visible
      //
      for(var f in self.markers.friends)
      {
        if(visibleMarkers[f] === undefined)
        {
          self.mc.removeMarker(self.markers.friends[f]);
          self.markers.friends[f].setMap(null);
          delete(self.markers.friends[f]);
          self.log("updateMarkers removed "+f);
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
    controlText.innerHTML = '<b><span id="onlineCount">No</span> Marauders</b> <span id="userCount"></span>';
    controlText.id = "marauderControlText";
    controlUI.appendChild(controlText);

    // Setup the click event listeners: simply set to fadeIn/Out the overlay
    google.maps.event.addDomListener(controlUI, 'click', function() {
      Marauder.toggleOverlay();
    });
  },
  moveMap2Myself: function(coordinates) {
    var self = this;
    if(self.markers.myself !== undefined)
    {
      coordinates = coordinates || self.markers.myself.getPosition();
      self.moveMap2MyselfRunning = true;
      self.setCenter( coordinates , 'moveMap2Myself');
      if(self.map.getZoom()<12)
        self.setZoom(18);
      self.moveMap2MyselfRunning = false;
    }
  },
  distHaversine: function(p1, p2) {
    var R = 6371; // earth's mean radius in km
    var dLat  = self.D2R(p2.lat() - p1.lat());
    var dLong = self.D2R(p2.lng() - p1.lng());

    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(self.D2R(p1.lat())) * Math.cos(self.D2R(p2.lat())) * Math.sin(dLong/2) * Math.sin(dLong/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    var d = R * c;

    return d.toFixed(3);
  },
  watchMyself: function(geoposition) {
    var self = this;
    // console.log(geoposition);
    if(self.markers && self.markers.myself)
    {
      try {
        var c = new google.maps.LatLng(geoposition.coords.latitude, geoposition.coords.longitude);
        // only update if different
        var d = self.distHaversine(c, self.markers.myself.getPosition());
        Session.set('message', JSON.stringify(d));
        console.log(d);
        if(d > 10.0)
        {
          Marauder.updateMyself(c, geoposition.timestamp);
          Marauder.moveMap2Myself(c);
        }
      } catch(err) {
        Session.set('message', 'watchMyself '+err.message);
      }
    }
  },
  createMarker: function(position, title, icon) {
    var self = this;
    var marker = null;
    if(position)
    {
      try {
        marker = new MarkerWithLabel({
          position: position,
          animation: google.maps.Animation.DROP,
          draggable: false,
          map: self.map,
          icon: icon,
          title: title,
          labelContent: title,
          labelAnchor: new google.maps.Point(10, 55),
          labelStyle: {fontSize:'10px', fontFamily:'sans-serif'}
        });
      } catch(e) {
        Session.set('message', e);
      }
    } else console.log(position);
    return marker;
  },
  updateMyMarker: function(coordinates, title) {
    var self = this;
    if(self.markers && self.markers.myself !== undefined)
    {
      self.markers.myself.setPosition(coordinates);
      self.markers.myself.setOptions({title: title});
    }
    else if(self.map !== undefined)
    {
      console.log('create marker for myself');
      self.markers.myself = self.createMarker(coordinates, title, 'myself.png');

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
      // anon user always get the map centered over the marker
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
    self = self || Marauder;
    timestamp = timestamp || new Date().getTime();
    if(self.markers)
    {
      if(!self.markers.myself)
      {
        self.log('updateMyself calling updateMyMarker');
        self.updateMyMarker(coordinates, title);
      }
      if(coordinates === undefined) coordinates = self.markers.myself.getPosition();
      self.conf('home', coordinates);
      if(user)
      {
        self.log('updateMyself');
        var uid = user._id;
        var coords = [ Marauder.D2R(coordinates.lng()), Marauder.D2R(coordinates.lat()) ];
        Meteor.users.update({_id: uid},{
          $set:{
            timestamp: timestamp,
            tracking: Session.get('tracking'),
            onlineonly: Session.get('onlineonly'),
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

      self.updateMyMarker(coordinates, title);
    }
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
          if(self.conf('timestamp') != position.timestamp)
          {
            var home = new google.maps.LatLng(position.coords.latitude,position.coords.longitude);
            self.conf('home', home);
            self.conf('timestamp', position.timestamp);
            self.updateMyself(home, position.timestamp);
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
    var weHaveNoCenter = false;
    if(self.config.zoom === null) self.config.zoom = 12;else self.conf('zoom', parseInt(self.config.zoom,10));
    if(!self.config.zoom || self.config.zoom < 2) self.conf('zoom', 12);
    if(!self.config.center)
    {
      self.conf('center', new google.maps.LatLng( 37.7701371389949, -122.41666322381593 ));
      // we have no center, so make sure we go into track mode
      self.log('we have no center');
      weHaveNoCenter = true;
    }
    else
    {
      try{
        self.conf('center', new google.maps.LatLng( self.config.center['jb'], self.config.center['kb'] ));
      } catch(e) {
        self.conf('center', new google.maps.LatLng( 37.7701371389949, -122.41666322381593 ));
      }
    }
    if(!self.config.home) self.conf('home', self.config.center);
    else {
      try {
        self.conf('home', new google.maps.LatLng( self.config.home['jb'], self.config.home['kb'] ));
      } catch(e) {
        self.conf('home', self.config.center);
      }
    }

    var mapOptions = {
          zoom: self.config.zoom,
          center: self.config.center,
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
          self.configSave(this);
          if( mode == 'home' || mode == 'friends') self.mode('browsing');
        }
    });

    google.maps.event.addListener(self.map, 'zoom_changed', function() {
        self.log("zoomed "+ this.getZoom());
        if(! self.moveMap2MyselfRunning)
        {
          var mode = self.mode();
          self.configSave(this);
          if( mode == 'home' || mode == 'friends' ) self.mode('browsing');
        }
    });

    google.maps.event.addListener(self.map, 'idle', function() {
      if(weHaveNoCenter)
      {
        $('div.button-toggles input.home').click();
      }
      Marauder.updateMarkers('map idle');
    });

    var controlDiv = document.createElement('div');
    var control = new self.marauderMapControl(controlDiv, self.map);
    controlDiv.index = 1;

    self.map.controls[google.maps.ControlPosition.TOP_RIGHT].push(controlDiv);

    self.updateMyself(self.config.home, new Date().getTime());

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

Template.marauder.message = function() {
  //
  return Session.get('message');
};

Template.marauder.rendered = function() {
  var user = Meteor.user();
  Marauder.log('Template.marauder.rendered');
  try {
    if(Session.get('tracking'))
      Marauder.markers.myself.setOptions({draggable: false});
    else
      Marauder.markers.myself.setOptions({draggable: true});
  } catch(e) {

  }

  if(Marauder.mode() == 'home') Marauder.moveMap2Myself();

  if(Session.get('tracking'))
    $('button.friends').attr('disabled','disabled');
  else
    $('button.friends').attr('disabled', null);
};

Template.map.rendered = function() {
  var c = Session.get('onlineCount');
  var userCount = Session.get('userCount');
  $('#userCount').html(userCount+ 'total');
  if(!Meteor.user()) c = 'Startup';
  $('#onlineCount').html(c);
};

Template.friends.friends = function() {
  // var updated = Session.get('updated');
  var onlineonly = Session.get('onlineonly');
  Marauder.log('Template.friends.friends');
  return Session.get('friends');
};

Template.friends.friendRequestBox = function() {
  //
  return Session.get('friendRequestBox');
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

Template.onlineCounter.userCount = function() {
  //
  return Session.get('userCount');
};

Template.onlineCounter.onlineCount = function() {
  //
  return Session.get('onlineCount');
};
//
// we use the onlineCounter to update Locations online status field
//
Template.onlineCounter.rendered = function() {
  var c = Session.get('onlineCount');
  var userCount = Session.get('userCount');
  $('#userCount').html(userCount+ 'total');
  Marauder.log('Template.onlineCounter.rendered ');
  if(!Meteor.user()) c = 'No';
  $('#onlineCount').html(c);
};

Template.marauder.events({
  'click button.stalk': function(e, tmpl) {
    if(Marauder.markers.selected)
    {
      var p = Marauder.markers.selected.getPosition();
      var n = new google.maps.LatLng(p.lat() - 0.00001, p.lng() - 0.00001);
      // place my marker slightely south west of my friend
      Marauder.markers.myself.setPosition( n );
      Marauder.mc.redraw();
      Marauder.setCenter(p);
      Marauder.setZoom(20);
      Marauder.updateMyself(n, new Date().getTime());
      // hide modal
      Marauder.hideModal();
      Session.set('message','');
    }
  },
  'click label[for="friend-request"], tap label[for="friend-request"]': function(e, tmpl) {
    // Session.set('friendRequestMessage','');
    var visible = Session.get('friendRequestBox');
    Session.set('friendRequestMessage','');
    if(visible)
    {
      // $('label[for="friend-request"]').html('Friend Request <sup>click me</sup>');
      // $('input.friend-request').hide();
      Session.set('friendRequestBox', false);
    }
    else
    {
      // $('label[for="friend-request"]').html('Friend Request');
      // $('input.friend-request').show();
      Session.set('friendRequestBox', true);
    }
  },
  'click a.marauder-hint, click #overlay button.close': function(e, tmpl) {
    e.preventDefault();
    $('#overlay').hide();
    Marauder.conf('overlay', false);
    $("#marauderControlText").css("color","black");
  },
  'click modal button.close': function(e, tmpl) {
    Session.set('message','');
    Marauder.hideModal();
    // Session.set('overlay', false);
    // Marauder.conf('overlay', false);
  },
  'click input.onlineonly': function(e, tmpl) {
    Session.set('onlineonly', !Session.get('onlineonly'));
    Session.set("activeModeDescription", Marauder.activeModeDescription() );
    Marauder.conf('onlineonly', Session.get('onlineonly'));
    Marauder.updateFriendsList(Session.get('onlineonly'));
  },
  'mouseover a.marauder-hint, mouseover a.updateFriends' : function(e, tmpl) {
    $("#marauderControlText").css({fontSize:"50px", padding:"10px"});
    $('#userCount').show();
  },
  'mouseout a.marauder-hint, mouseout a.updateFriends' : function(e, tmpl) {
    $("#marauderControlText").css({fontSize:"12px", padding:"0px"});
    $('#userCount').hide();
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
          Marauder.configSave(Marauder.map);
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
    Marauder.updateMarkers('button');
  }
});

Template.buttons.events({
  'click span.error': function(e, tmpl) {
    Session.set('message', '');
  },
  'click input.tracking': function(e, tmpl) {
    var c = $(e.target).attr("checked");
    Session.set("tracking", c ? true : false );
    Marauder.conf('tracking', Session.get('tracking'));
    try {
      if(c)
      {
        Marauder.markers.myself.setOptions({draggable: false});
        Marauder.updateLocation();
        Marauder.watchid = navigator.geolocation.watchPosition(Marauder.watchMyself);
      }
      else
      {
        Marauder.markers.myself.setOptions({draggable: true});
        if(Marauder.watchid)
        {
          navigator.geolocation.clearWatch(Marauder.watchid);
          Marauder.watchid = undefined;
        }
      }
    } catch(e) {

    }
    Session.set('activeModeDescription', Marauder.activeModeDescription());
  },
  'click button.friends': function(e,tmpl) {
    var onlineonly = Session.get('onlineonly');
    Marauder.mode('friends');
    try {
      Marauder.markers.myself.setOptions({draggable: false});
    } catch(e) {

    }

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
        try {
          bounds.extend(Marauder.markers.myself.getPosition());
        } catch(e) {

        }
        // make the map fit
        Marauder.map.fitBounds(bounds);
        // make sure the new bounds are set so our subscribe picks them up
        // update friends
        // Marauder.updateMarkers('myFriends');
        Marauder.moveMap2MyselfRunning = false;
        Marauder.configSave(Marauder.map);
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
    var uid = Meteor.userId();
    // if we have a location field, add to markers if it doesn't exist yet
    if(fields.location !== undefined && id != uid)
    {
      Marauder.log("observed users changed "+id);
      // my own changes do not register here since id == Meteor.userId is
      // not part of markers.friends but markers.myself
      if(Marauder.markers.friends[id] !== undefined)
      {
        Marauder.markers.friends[id].setPosition(Marauder.userLatLng(fields.location));
        // if(fields.profile)
        // Marauder.markers.friends[id].setIcon(fields.profile.online ? 'friend.png' : 'offline.png');
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
        try {
          Marauder.markers.myself.setTitle('Myself '+id);
        } catch(e) {

        }
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
              Marauder.markers.friends[id] = Marauder.createMarker(c, userName, fields.profile.online ? 'friend.png' : 'offline.png');

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
      Session.set('friendRequestMessage', 'removed friend '+Marauder.markers.friends[id].getTitle());
      Marauder.mc.removeMarker(Marauder.markers.friends[id]);
      Marauder.markers.friends[id].setMap(null);
      delete(Marauder.markers.friends[id]);
      Marauder.log("observed users removed "+id);
      Session.set('message','');
      Session.set('updated', new Date().getTime());
    } else Session.set('friendRequestMessage', 'friend removed');
    Marauder.toggleOverlay(true);

    Marauder.updateFriendsList(Session.get('onlineonly'));
  }
});
Requests.find().observeChanges({
  changed: function(id, fields) {
    // console.log('request changed '+id);
    Session.set('friendRequestMessage', 'changed friend request '+fields.requester.email);
    Marauder.toggleOverlay(true);
  },
  added: function(id, fields) {
    var uid = Meteor.userId();
    // console.log('request added '+id);
    Marauder.updateFriendsList(Session.get('onlineonly'));
    if(uid && fields.requester.id != uid)
    {
      Session.set('friendRequestMessage', 'new friend request from '+fields.requester.email);
      Marauder.toggleOverlay(true);
    }
  },
  removed: function(id) {
    // console.log('request removed '+id);
    Marauder.updateFriendsList(Session.get('onlineonly'));
    // Session.set('friendRequestMessage', 'friend removed');
  }
});

Meteor.startup(function(){
  Marauder.config = localStorage.getItem('marauder');
  if(Marauder.config === null)
  {
    console.log('initialize config');
    Marauder.config = {
      tracking: true,
      onlineonly: false,
      overlay: true,
      debug: false,
      center: null,
      boundary: null,
      home: null
    };
    localStorage.setItem('marauder', JSON.stringify(Marauder.config));
  }
  else Marauder.config = JSON.parse(Marauder.config);

  // console.log(Marauder.config);

  if(Marauder.config.tracking) Session.set('tracking', true);
  if(Marauder.config.onlineonly) Session.set('onlineonly', true);
  if(Marauder.config.showModal) Session.set('showModal', true);
  else Session.set('showModal', false);

  Marauder.log("client startup");
  Marauder.initialize();
  Hooks.init();

  window.addEventListener('pagehide', function() {
    var s = Meteor.status();
    Session.set('message', 'hide '+s.status+' '+new Date());
    console.log('pagehide');
  });

  window.addEventListener('pageshow', function(){
    var s = Meteor.status();
    if(s.status != 'connecting')
    {
      Session.set('message', 'show '+s.status+' '+new Date());
      console.log(s.status);
      // Meteor.default_connection._stream._lostConnection();
      Meteor.reconnect();
    }
    Session.set('updated', new Date().getTime());
  }, false);
  // Marauder.updateMarkers('startup');
});

Deps.autorun(function(computation) {
  computation.onInvalidate(function() {
    // if(Marauder.config.debug) console.trace();
  });

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

  Meteor.call('userCount', function(err, userCount) {
    if(err)
    {
      Session.set('userCount', err);
    }
    else
    {
      Session.set('userCount', userCount);
    }
  });

  if(user)
  {
    if(Session.get('loggedIn') === false)
    {
      // update my marker with my last stored location
      var c = Marauder.userLatLng(user.location);
      Marauder.log('autorun loggedIn true');
      Marauder.conf('home', c);
      Marauder.updateMyMarker(c, 'Myself');
      Session.set('friendRequestMessage','');
      if(user.tracking !== undefined)
      {
        Session.set('tracking', user.tracking);
        Marauder.conf('tracking', user.tracking);
      }
      if(user.onlineonly !== undefined)
      {
        Session.set('onlineonly', user.onlineonly);
        Marauder.conf('onlineonly', user.onlineonly);
      }
      // Marauder.updateFriendsList(Session.get('onlineonly'));
      // Marauder.configSave(Marauder.map);
      Session.set('loggedIn', true);
    }
    //
    // only subscribe to locations if we have a boundary
    //
    if(Marauder.config.boundary !== undefined && Marauder.config.boundary !== null)
    {
      // console.log(Marauder.config.boundary);
      // subscribe stories for current position
      Marauder.locationsCursor = Meteor.subscribe('locations', Marauder.config.boundary, onlineonly, function(x){
        Marauder.log(Meteor.users.find().count()+' locations subscribed '+new Date().getTime());
        Marauder.updateMarkers('locations subscribed');
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

  if(Session.get('tracking') && Marauder.watchid === undefined)
  {
    Marauder.watchid = navigator.geolocation.watchPosition(Marauder.watchMyself);
  }
});
