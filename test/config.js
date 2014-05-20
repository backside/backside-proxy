// require in the primary config container, override what we want for test
var container = require("../config")

// override the logger for log free tests
container.register("logger", function() {
  return {
    log: function() {},
    info: function() {},
    debug: function() {}
  }
})

module.exports = container

