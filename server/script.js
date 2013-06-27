Marauder.debug = false;

Meteor.startup(function () {
  // code to run on server at startup
  Accounts.emailTemplates.siteName = "test.ma.rauder.net:4000";
  Accounts.emailTemplates.from = "webmaster@cotren.net";
});

//
// this will put myself into the collection
//
Meteor.publish("userData", function () {
  return Meteor.users.find(
    {_id: this.userId},
    {fields: {'emails': 1,'timestamp': 1,location:1}}
  );
});
//
// this will add all my online friends based on boundary
//
Meteor.publish("locations", function(boundary) {
  // boundary contains bound.northEast and bound.southWest
  if(this.userId && boundary !== null && boundary.ne.jb !== undefined)
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
      location: { $geoWithin: {$box: box} },
      friends: {$elemMatch: { friend: this.userId }}
    };
    // , "profile.online": true
    // $or does not work with $geoWithin
    // var query = {$or:[ {location: { $geoWithin: {$box: box} }}, {userId: this.userId}]};
    Marauder.debugString(JSON.stringify(query));
    var locations = Meteor.users.find(query);
    Marauder.debugString(locations.count()+' users published');
    return locations;
  }
  else
  {
    return boundary;
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
  locateUser: function(userId) {
    var user = Meteor.users.findOne({_id: userId});
    return user;
  },
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
