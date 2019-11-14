const http = require('./http-initiate');
const io = require('socket.io')(http);

io.on('connection', socket => {
  io.sockets.emit(
    'user-joined',
    socket.id,
    io.engine.clientsCount,
    Object.keys(io.sockets.clients().sockets),
  );

  socket.on('signal', (toId, message) => {
    io.to(toId).emit('signal', socket.id, message);
  });

  socket.on('message', data => {
    io.sockets.emit('broadcast-message', socket.id, data);
  });

  socket.on('disconnect', () => {
    io.sockets.emit('user-left', socket.id);
  });
});

http.listen(port || 3000, () => {
  console.log('listening on', port);
});
