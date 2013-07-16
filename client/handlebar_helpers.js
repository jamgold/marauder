Handlebars.registerHelper('getMode', function(button) {
  return Session.get('mode') == button ? 'active' : '';
});

Handlebars.registerHelper('doWeHaveFriends', function(button) {
  var user = Meteor.user();
  if(user.friends === undefined) user.friends = [];
  return (Requests.find().count() > 0 ) || (user.friends.length > 0);
});

Handlebars.registerHelper('isChecked', function(e){
    var c = Session.get(e);
    return c ? "checked" : "";
});

Handlebars.registerHelper('isFriend', function(user){
  var my = Meteor.user();
  var isFriend = 'no';
  if(my.friends)
  {
    my.friends.forEach(function(f){
      if(f.friend !== undefined && f.friend == user._id)
        isFriend = 'unfriend';
    });
  }
  return isFriend;
});

Handlebars.registerHelper('requestApprove', function(r) {
  return Meteor.userId() != r.requester.id ? "<a href=# class=approverequest title='approve this friend request; you will see eachother on the map' id="+r._id+">approve</a>" : "";
});

Handlebars.registerHelper('requestRemove', function(r) {
  return Meteor.userId() != r.requester.id ? "deny" : "forget";
});

Handlebars.registerHelper('myOwnRequest', function(r) {
  return Meteor.userId() == r.requester.id ? r.friend.email : r.requester.email;
});

Handlebars.registerHelper('showOverlay', function(){
  // var updated = Session.get('updated');
  // var ov = Session.get('overlay');
  var display = 'block';
  var o = Marauder.config.overlay;
  var user = Meteor.user();
  if(user === null || o === null)
  {
    $("#marauderControlText").css("color","#aaa");
    Marauder.conf('overlay', true);
  } else {
    if(o === 'false' || o === false)
    {
      display = 'none';
    } else
      $("#marauderControlText").css("color","#aaa");
  }
  Marauder.log('Handlebars.registerHelper.display_state '+display);
  return display;
});

Handlebars.registerHelper('getEmail', function(user) {
  if(user && user.emails !== undefined && user.emails.length>0)
    return user.emails[0].address;
  else return 'none';
});

Handlebars.registerHelper('getOnlineStatus', function(user){
  return user.profile && user.profile.online ? "online" : "offline";
});
