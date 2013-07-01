Requests = new Meteor.Collection("requests");
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
	this.log = function(s) {
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
		self.log("setting map");
		this.map = map;
	},
	friendQuery: function (userId) {
		return {friends: {$elemMatch: { friend: userId } }};
		// $or: [
		//  {friends: {$elemMatch: { friend: this.userId } } },
		//  {friends: {$elemMatch: { request: this.userId } } }
		// ]
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
				// find all my friends and exclude myself
				var query = {
					_id:{$ne: this.userId}
				};
				query = _.extend(query, Marauder.friendQuery(this.userId));
				// sort by online status and email address
				friends = Meteor.users.find(query,{sort: {'profile.online': -1,'emails.address': 1}});
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
	friendRequest: function(email) {
		if(this.isSimulation)
		{
			return "checking";
		}
		else
		{
			var f = Meteor.users.findOne({"emails.address":email});
			if(f !== undefined)
			{
				if(f._id == this.userId)
				{
					throw new Meteor.Error(403, "You can not request a friendship with yourself! Are you schizophrenic?");
				}
				else
				{
					// check if we already have a request involving this id
					var x = Requests.findOne({"requester.id":f._id});
					if(x)
					{
						throw new Meteor.Error(403, "There already is a request between you and that user");
					}
					else
					{
						var user = Meteor.user();
						var r = Requests.insert({requester:{id: this.userId, email: user.emails[0].address}, friend: {id: f._id, email: email}});
						return r;
					}
				}
			}
			else
			{
				throw new Meteor.Error(403, "User e-mail does not exist");
			}
		}
	},
	approveRequest: function(rid) {
		if(this.isSimulation)
		{
			return "checking";
		}
		else
		{
			var r = Requests.findOne({_id: rid});
			if(r!==undefined)
			{
				var friend = r.friend.id;
				var requester = r.requester.id;

				Meteor.users.update({_id: friend}, { $push: { friends: {friend: requester} } });
				Meteor.users.update({_id: requester}, { $push: { friends: {friend: friend} } });
			}
			else
			{
				throw new Meteor.Error(403, "Invalid request id "+rid);
			}
		}
	},
	removeFriendship: function(friendId) {
		if(!this.isSimulation)
		{
			var my = Meteor.user();
			var friends = [];
			my.friends.forEach(function(f){
				if(f.friend !== undefined && f.friend != friendId)
					friends.push(f);
			});
			// if(!isFriend) friends.push({friend: friendId});
			Meteor.users.update({_id: this.userId},{$set: {friends: friends}});
			//
			// we need to do the same for the friendId
			//
			var friend = Meteor.users.findOne({_id: friendId});
			if(friend)
			{
				friends = [];
				friend.friends.forEach(function(f){
					if(f.friend !== undefined && f.friend != my._id)
						friends.push(f);
				});
				Meteor.users.update({_id: friendId},{$set: {friends: friends}});
			}
			return "done";
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
	},
	locateUser: function(userId) {
		if(this.isSimulation)
		{
			return "looking";
		}
		else
		{
			var user = Meteor.users.findOne({_id: userId});
			return user;
		}
	}
});
