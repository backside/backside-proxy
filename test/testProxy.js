var config = require("./config")
var proxy = config.get("proxy")
var assert = require("assert")
describe("proxy", function() {
  describe("topic rewriting", function() {
    it("should rewrite stomp queues to rabbit ones", function() {
      assert.equal(proxy.buildRabbitTopic("/foo/bar/baz"), "/exchange/backside/foo.bar.baz.#")
      assert.equal(proxy.buildRabbitTopic("/"), "/exchange/backside/#")
      assert.equal(proxy.buildRabbitTopic("/what/up/fool/"), "/exchange/backside/what.up.fool.#")
    })

    it("should rewrite rabbit topics back to corresponding stomp topic", function() {
      assert.equal(proxy.buildStompTopic("/exchange/backside/foo.bar.baz.#"), "/foo/bar/baz")
      assert.equal(proxy.buildStompTopic("/exchange/backside/#"), "/")
      assert.equal(proxy.buildStompTopic("/exchange/backside/what.up.fool.#"), "/what/up/fool")
    })

  })
})
