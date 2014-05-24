
var api = require("backside-api")
var StompProxy = require("stomp-proxy")
var Frame = StompProxy.Frame

module.exports = function(stompServer, STOMP_USERNAME, STOMP_PASSWORD, STOMP_EXCHANGE, logger) {
  function buildRabbitTopic(topic) {
    if (topic.charAt(0) === '/') {
      topic = topic.substr(1)
    }
    topic = topic.replace(/\//g, ".")
    if (topic.length && topic.charAt(topic.length - 1) !== '.') {
      topic += "."
    }

    return "/exchange/" + STOMP_EXCHANGE + "/" + topic + "#"
  }

  function buildStompTopic(topic) {
    topic = topic.replace("/exchange/" + STOMP_EXCHANGE + "/", "")
    topic = topic.replace("#", "")
    topic = topic.replace(/\./g, "/")
    if (topic.length && topic.charAt(topic.length - 1) === "/") {
      topic = topic.substr(0, topic.length - 1)
    }
    return "/" + topic
  }

  return {
    buildRabbitTopic: buildRabbitTopic,
    buildStompTopic: buildStompTopic,
    createProxy: function(conn) {
      var stompConn = stompServer.createConnection()
      var proxy = new StompProxy(conn, stompConn)
      stompConn.on("connect", function() {
        proxy.start()
        logger.log("debug", "connection opened to stomp server")
      })

      function onConnect(session, frame, cb) {
        var username = frame.headers.login
        var password = frame.headers.passcode
        api.loadUser(username, password, function(err, user) {
          if (err) return cb(err)

          //translate the headers to be the actual login headers for STOMP
          frame.headers.login = STOMP_USERNAME
          frame.headers.passcode = STOMP_PASSWORD
          session.login = true
          session.user = user
          cb(null, frame)
        })
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
        api.set(session.user, frame.headers.destination, frame.body, frame.headers.priority, function(err, message) {
          if (err) return cb(err)

          // send the callback without the frame to drop it from sending
          // to the backend and let the api take care of broadcasting it
          cb()
        })
      })

      proxy.onSubscribe = notLoggedIn.bind(proxy, function(session, frame, cb) {
        var self = this
        var dest = frame.headers.destination
        var id = frame.headers.id
        if (!dest) {
          return cb(new Error("frame is missing destination header"))
        }


        var rabbitTopic = buildRabbitTopic(dest)
        frame.headers.destination = rabbitTopic
        logger.log("debug", "retrieving topic to " + rabbitTopic)


        api.get(session.user, dest, function(err, initialState) {
          if (err) {
            return cb(new Error("fetching initial state failed: " + err.message))
          }
          var msg = {
            key: dest,
            message: initialState
          }
          self.interjectFrame(
            new Frame("MESSAGE", {destination: dest, subscription: id}, JSON.stringify(msg))
          )
          cb(null, frame)
        })
      })

      proxy.onMessage = function(session, frame, cb) {
        frame.headers.destination = buildStompTopic(frame.headers.destination)
        cb(null, frame)
      }
      return proxy
    }
  }
}
