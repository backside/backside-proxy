var EventEmitter = require("events").EventEmitter
var Transform = require("stream").Transform
var util = require("util")
var Frame = require("stompjs").Frame
var async = require("async")
var DEBUG = false
var debug = function() {
  if(DEBUG) {
    console.log.apply(null, arguments)
  }
}

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

NULL_BYTE = '\x00'

function StompEvents(client, server) {
  var self = this
  EventEmitter.call(this)
  this.session = {}
  this.proxy = new Transform()
  //start paused until start is called
  this.proxy.pause()
  this.proxy._transform = function(chunk, encoding, cb) {
    var transformer = this
    if (typeof chunk !== "string") {
      chunk = chunk.toString("utf8")
    }

    frames = Frame.unmarshall(chunk)

    if (!frames.length) {
      return cb()
    }

    async.map(frames, self.dispatch.bind(self), function(err, newFrames) {
      if (err) {
        return self.emit("error", err)
      }

      for (var i = 0; i < frames.length; i++) {
        var frameObj = newFrames[i]
        if (frameObj.error) {
          self.sendError(frameObj.origFrame, frameObj.error)
          // if the error was fatal, we want to bail out and kill the sockets
          if (frameObj.error.fatal) return self.kill(frameObj.error)
          continue
        }

        if (!frameObj.frame) continue

        transformer.push(frameObj.frame.toString() + NULL_BYTE)
      }
      cb()
    })

  }

  this.client = client
  this.client.pipe(this.proxy)
  this.client.on("close", function() {
    self.emit("clientClose")
    self.close()
  })

  this.server = server
  // pipe the client to our proxy, and connect it up to the server after transforming
  this.proxy.pipe(this.server)
  // connect the server straight to the client
  this.server.pipe(this.client)
  this.server.on("data", function(r) {
    debug("rab r", r.toString())
  })

  // set up the error handlers
  this.server.on("close", function() {
    self.emit("serverClose")
    self.close()
  })
}

util.inherits(StompEvents, EventEmitter)

StompEvents.prototype.start = function() {
  this.proxy.resume()
}

StompEvents.prototype.dispatch = function(frame, cb) {
  // assume empty command is a heartbeat
  if (frame.command === "") {
    return cb(null, {error: null, frame: frame, origFrame: frame})
  }

  var funcName = "on" + capFirst(frame.command)
  if (!this[funcName]) {
    var err = new Error("invalid stomp command " + frame.command)
    this.emit("error", err)
    return cb(null, {error: err, frame: frame, origFrame: frame})
  }
  // clone the frame so it can be modified, while we still maintain an original for
  // errors and bookkeeping
  this[funcName].call(this, this.session, cloneFrame(frame), function(err, newFrame) {
    console.log("calling", funcName)
    // we don't want to stop map execution for an error, just collect the results
    cb(null, {error: err, frame: newFrame, origFrame: frame})
  })
}

StompEvents.prototype.sendError = function(origFrame, err) {
  var headers = {}
  if (origFrame.headers["receipt"]) {
    headers["receipt-id"] = origFrame.headers["receipt"]
  }
  headers["message"] = err.message || "Invalid Message Received"
  var body = err.messageBody || buildErrorBody(origFrame, err)
  headers["content-length"] = body.length
  headers["content-type"] = "text/plain"
  var errorFrame = new Frame("ERROR", headers, body)
  this.interjectFrame(errorFrame)
}
StompEvents.prototype.interjectFrame = function(frame) {
  this.client.write(frame.toString() + NULL_BYTE)
}

StompEvents.prototype.kill = function(err) {
  if (err) {
    this.emit("error", new Error("recieved fatal error, original error was: " + err.message))
  }
  this.close()
}

StompEvents.prototype.close = function() {
  this.emit("close")
  if (this.client.close) {
    this.client.close()
  } else {
    this.client.destroy()
  }
  this.server.destroy()
}

// install the default handlers for each method
for (var i = 0; i < commands.length; i++) {
  var funcName = "on" + capFirst(commands[i])
  StompEvents.prototype[funcName] = function(session, frame, cb) {
    cb(null, frame)
  }
}

module.exports = function() {
  return StompEvents
}

function buildErrorBody(origFrame, err) {
  var body = "The message with method of " + origFrame.command + " and headers: \n"
  for (var k in origFrame.headers) {
    var v = origFrame.headers[k]
    body += [k, v].join(":") + "\n"
  }
  var mess = err.message || "Unknown reason"
  body += "\nis invalid for:\n" + mess
  return body
}

function capFirst(str) {
  var lower = str.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.substr(1)
}

function cloneFrame(frame) {
  var headers = JSON.parse(JSON.stringify(frame.headers))
  return new Frame(frame.command, headers, frame.body)
}