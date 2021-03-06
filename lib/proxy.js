
var StompProxy = require("stomp-proxy")
var Frame = StompProxy.Frame

module.exports = function(api, stompServer, STOMP_USERNAME, STOMP_PASSWORD, STOMP_EXCHANGE, logger) {
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

        // rewrite headers
        frame.headers.login = STOMP_USERNAME
        frame.headers.passcode = STOMP_PASSWORD
        // login state doesn't indicate if anonymous or real user, simply that
        // connect frame was sent
        session.login = true
        // if no username is sent, assume anonymous login
        if (!username) return cb(null, frame)

        api.loadUser(username, password, function(err, isValid, user) {
          if (err) return cb(err)
          if (!isValid) return cb(new Error("bad username or password sent"))

          //translate the headers to be the actual login headers for STOMP
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
        // Use JSON.parse to figure out type of value. Maybe switch to
        // use content-type header at some point instead.
        var val;
        try {
          val = JSON.parse(frame.body);
        } catch (e) {
          return cb("Invalid value")
        }

        api.set(session.user, frame.headers.destination, val, frame.headers.priority, function(err, message) {
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
