Handlebars.registerHelper('getMode', function(button) {
  return Session.get('mode') == button ? 'active' : '';
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
  return Meteor.userId() != r.requester.id ? "<a href=# class=approverequest id="+r._id+">approve</a>" : "";
});

Handlebars.registerHelper('requestRemove', function(r) {
  return Meteor.userId() != r.requester.id ? "deny" : "forget";
});

Handlebars.registerHelper('myOwnRequest', function(r) {
  return Meteor.userId() == r.requester.id ? r.friend.email : r.requester.email;
});

Handlebars.registerHelper('getDisplayState', function(){
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
  Marauder.log('Handlebars.registerHelper.display_state '+display);
  return display;
});

Handlebars.registerHelper('getEmail', function(user) {
  return user.emails[0].address;
});
