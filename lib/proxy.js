
var Frame = require("stompjs").Frame
var api = require("backside-api").persistence
module.exports = function(stompServer, StompEvents, STOMP_USERNAME, STOMP_PASSWORD, logger) {
  return {
    createProxy: function(conn) {
      var stompConn = stompServer.createConnection()
      var proxy = new StompEvents(conn, stompConn)
      stompConn.on("connect", function() {
        proxy.start()
        logger.log("debug", "connection opened to stomp server")
      })

      function onConnect(session, frame, cb) {
        var username = frame.headers.login
        var password = frame.headers.passcode
        if (username !== "addison" || password !== "stuff") {
          var err = new Error("invalid username or password!")
          err.fatal = true
          return cb(err)
        }
        //translate the headers to be the actual login headers for STOMP
        frame.headers.login = STOMP_USERNAME
        frame.headers.passcode = STOMP_PASSWORD
        session.login = true
        session.username = "addison"
        cb(null, frame)
      }
      proxy.onConnect = onConnect
      proxy.onStomp = onConnect

      function notLoggedIn(next, session, frame, cb) {
        if (!session.login) {
          var err = new Error("not logged in, must send connect frame first!")
          err.fatal = true
          return cb(err)
        }
        next.call(this, session, frame, cb)
      }

      // ghetto middleware type approach using bind
      proxy.onSend = notLoggedIn.bind(proxy, function(session, frame, cb) {
        cb(null, frame)
      })
      proxy.onSubscribe = notLoggedIn.bind(proxy, function(session, frame, cb) {
        var self = this
        var dest = frame.headers.destination
        var id = frame.headers.id
        if (!dest) {
          return cb(new Error("frame is missing destination header"))
        }

        var topic = "/" + dest.split("/").pop().replace("#", "")

        api.get(topic, function(err, initialState) {
          if (err) {
            return cb(new Error("fetching initial state failed: " + err.message))
          }
          self.interjectFrame(
            new Frame("MESSAGE", {destination: topic, subscription: id}, JSON.stringify(initialState))
          )
          cb(null, frame)
        })
      })
      return proxy
    }
  }
}
