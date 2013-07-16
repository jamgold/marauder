Marauder.config.debug = false;

// Meteor.AppCache.config({
//   chrome: false,
//   firefox: true,
//   ie: false,
//   mobileSafari: true,
//   safari: true
// });

Meteor.startup(function () {
  // code to run on server at startup
  //Accounts.emailTemplates.siteName = "test.ma.rauder.net:4000";
  Accounts.emailTemplates.siteName = "ma.rauder.net";
  // Accounts.emailTemplates.from = "webmaster@cotren.net";
  Meteor.users._ensureIndex('location', '2dsphere');
  // Meteor.users._transform = function(doc) {
  //   return doc;
  // };
});

//
// this will put myself into the collection
//
Meteor.publish("userData", function () {
  return Meteor.users.find(
    {_id: this.userId},
    {
      fields: {'emails': 1,'location':1,'friends':1,'profile':1,'tracking':1,'onlineonly':1}
    }
  );
});

Meteor.publish("friends", function() {
  var friends = Meteor.users.find(
    Marauder.friendQuery(this.userId),
    {
      'fields': {'emails': 1,'profile':1,'location':1}
    }
  );
  Marauder.log(friends.count()+' users published');
  return friends;
});
//
// friend requests
//
Meteor.publish("requests", function() {
  if(this.userId)
  {
    // console.log("publish requester.id/friend.id = "+this.userId);
    return Requests.find({ $or: [{"requester.id": this.userId},{"friend.id": this.userId}]});
  }
  return null;
});
//
// this will add all my online friends based on boundary
//
Meteor.publish("locations", function(boundary, onlineonly) {
  onlineonly = onlineonly || false;
  // boundary contains bound.northEast and bound.southWest
  if(this.userId && boundary !== null && boundary.ne.jb !== undefined && boundary.ne.jb !== null)
  {
    var myself = this.userId;
    //
    // http://docs.mongodb.org/manual/reference/operator/box/#op._S_box
    // Important If you use longitude and latitude, specify longitude first
    //
    // we need to convert to radians, because that is how MongoDB stores it
    //
    var tr = [ Marauder.D2R(boundary.ne.kb), Marauder.D2R(boundary.ne.jb) ];
    var bl = [ Marauder.D2R(boundary.sw.kb), Marauder.D2R(boundary.sw.jb) ];
    // create our box as array
    var box = [ bl, tr ];
    // find all users withing the box
    var query = {
      location: { $geoWithin: {$box: box} }
    };
    // , "profile.online": true
    // add friends query
    query = _.extend(query, Marauder.friendQuery(this.userId, onlineonly));
    // $or does not work with $geoWithin
    // var query = {$or:[ {location: { $geoWithin: {$box: box} }}, {userId: this.userId}]};
    // console.log(JSON.stringify(query));
    var locations = Meteor.users.find(
      query,
      {
        fields: {'emails':1,'timestamp':1,'location':1,'profile':1}
      }
    );
    // Marauder.log(locations.count()+' users published');
    return locations;
  }
  else
  {
    return null;
  }
});

Requests.allow({
  remove: function(userId, document) {
    return document.requester.id == userId || document.friend.id == userId;
  }
});

Meteor.users.allow({
  update: function (userId, user, fields, modifier) {
    // can only change your own documents
    if(user._id === userId)
    {
      Meteor.users.update({_id: userId}, modifier);
      return true;
    }
    else return false;
  }
});

Meteor.methods({
  sendVerificationEmail: function(userId, address) {
    //
    // check if there is a pending verification token and re-use
    //
    //
    var tr = Meteor.users.findOne(
      {_id: userId, 'services.email.verificationTokens.address': address},
      {'services.email.$.token':1}
    );

    if(tr)
    {
        var user = Meteor.users.findOne(userId);

        var tokenRecord = tr.services.email.verificationTokens[0];

        var verifyEmailUrl = Accounts.urls.verifyEmail(tokenRecord.token);

        Email.send({
          to: address,
          from: Accounts.emailTemplates.from,
          subject: Accounts.emailTemplates.verifyEmail.subject(user),
          text: Accounts.emailTemplates.verifyEmail.text(user, verifyEmailUrl)
        });
    }
    else
    {
      Accounts.emailTemplates.siteName = "test.ma.rauder.net:4000";
      Accounts.emailTemplates.from = "webmaster@cotren.net";
      Accounts.sendVerificationEmail(userId, address);
    }
  }
});

Hooks.onLoggedOut = function (userId) {
  var u = Meteor.users.findOne({_id: userId});
  if(u)
  {
    console.log('Logged out user '+userId+'. Number of login tokens: '+u.services.resume.loginTokens.length);
    // Meteor.users.update({_id: userId},{$set:{"services.resume.loginTokens":[]}});
  }
};
