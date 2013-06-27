Locations = new Meteor.Collection("locations");
// automatically there
//
// https://github.com/tmeasday/meteor-presence
// https://github.com/BenjaminRH/meteor-event-hooks
// http://stackoverflow.com/questions/16566631/getting-specific-user-data-from-meteor-presence
//
Accounts.config({
  sendVerificationEmail: true
  //,forbidClientAccountCreation: true
});

function MarauderObject(options) {
	// make sure options is set
	options = options || {};
	// set map to null
	this.map = undefined;
	this.debug = false;

	this.D2R = function(deg) {
		return deg * Math.PI / 180;
	};
	this.R2D = function(rad) {
		return rad / Math.PI * 180;
	};
	this.debugString = function(s) {
		if(this.debug)
		{
			if(Meteor.isClient)
			{
				// $('ul.console_log').prepend('<li>'+s+'</li>');
				console.log(s);
			}
			else
			{
				console.log(s);
			}
		}
	};
}

MarauderObject.prototype = {
	constructor: MarauderObject(),
	setMap: function(map) {
		var self = this;
		self.debugString("setting map");
		this.map = map;
	}
};

Marauder = new MarauderObject();

Meteor.methods({
	onlineFriends: function(userId) {
		if(this.isSimulation)
		{
			return [{userName:'fetching...'}];
		}
		else
		{
			var r = [];
			var friends;
			if(this.userId)
			{
				// find all my friends
				//friends = Meteor.users.find({"profile.online": true,_id:{$ne: this.userId}});
				friends = Meteor.users.find({
					_id:{$ne: this.userId},
					friends: {$elemMatch: { friend: this.userId } }
				});
				if(friends.count()>0)
				{
					friends.forEach(function(u){
						if(u.profile === undefined)
							u.profile = {online: false};
						if(u.location !== undefined)
							r.push(u);
					});
				}
			}
			return r;
		}
	},
	myLocation: function() {
		if(this.isSimulation)
		{
			return null;
		}
		else
		{
			return Meteor.users.findOne({userId: this.userId});
		}
	}
});
