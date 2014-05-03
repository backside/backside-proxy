backside-proxy
============

A websocket/STOMP proxy that supports custom auth and intercepting certain operations

# Description
Backside leverages RabbitMQ speaking AMQP to take care of its realtime messaging needs, however, in order to do robust
authentication and authorization, as well as validation of publish messages, a STOMP aware gateway/proxy to take care of
this stuff
