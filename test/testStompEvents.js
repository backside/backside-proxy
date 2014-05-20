
var config = require("./config")
var Frame = require("stompjs").Frame
var assert = require("assert")
var through = require("through")
var duplexer = require("duplexer")

var StompEvents = config.get("StompEvents")

var commands = [
  "STOMP",
  "CONNECT",
  "SEND",
  "SUBSCRIBE",
  "UNSUBSCRIBE",
  "ACK",
  "NACK",
  "BEGIN",
  "COMMIT",
  "ABORT",
  "DISCONNECT"
]

describe("StompEvents", function() {
  describe("message tests", function() {

    var readable = through()
    var writeable = through()
    var stream = duplexer(writeable, readable)
    var proxy = new StompEvents(stream, stream)
    proxy.start()

    for(var i = 0; i < commands.length; i++) {
      var reader = through()
      stream.pipe(reader)
      var command = commands[i]
      it("should support the " + command, function(done) {
        var method = "on" + (command.charAt(0) + command.toLowerCase().substr(1))
        var wasCalled = false
        var str = Frame.marshall(command, {stuff: "foo"}, "1234")
        proxy[method] = function(session, frame, cb) {
          wasCalled = true
          cb(null, frame)
        }
        reader.on("data", function(data) {
          data = data.toString("utf8")
          console.log("data", data)
          var nf = Frame.unmarshall(data)
          assert(nf.length, 1)
          assert(nf[0].command, command)
          assert(wasCalled)
          done()
        })
        console.log("wtf, how many you writing?", str)
        stream.write(str)

      })
    }
  })
})
