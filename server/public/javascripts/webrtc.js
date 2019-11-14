let localVideo = document.getElementById('localVideo');
let firstPerson = false;
let socketCount = 0;
let socketId;
let localStream;
let connections = [];

const config = {
  host: 'https://trycatch.growd.me:443',
};

let peerConnectionConfig = {
  iceServers: [
    { urls: 'stun:stun.services.mozilla.com' },
    { urls: 'stun:stun.l.google.com:19302' },
  ],
};

const getUserMediaSuccess = stream => {
  localStream = stream;
  localVideo.srcObject = stream;
};

const gotRemoteStream = (event, id) => {
  const video = document.createElement('video');
  const wrapper = document.createElement('div');
  const videos = document.querySelector('.videos');

  wrapper.classList.add('video-wrapper');
  video.setAttribute('data-socket', id);
  video.srcObject = event.stream;
  video.autoplay = true;
  video.muted = true;
  video.playsinline = true;

  wrapper.appendChild(video);
  videos.appendChild(wrapper);
};

function pageReady() {
  const constraints = {
    video: true,
    audio: false,
  };

  if (!navigator.mediaDevices.getUserMedia) {
    alert('Your browser does not support getUserMedia API');
    return;
  }

  navigator.mediaDevices
    .getUserMedia(constraints)
    .then(getUserMediaSuccess)
    .then(function() {
      socket = io.connect(config.host, {
        secure: true,
      });
      socket.on('signal', gotMessageFromServer);

      socket.on('connect', function() {
        socketId = socket.id;

        socket.on('user-left', function(id) {
          var video = document.querySelector(`[data-socket="${id}"]`);
          var parentDiv = video.parentElement;
          video.parentElement.parentElement.removeChild(parentDiv);
        });

        socket.on('user-joined', function(id, count, clients) {
          clients.forEach(function(socketListId) {
            if (!connections[socketListId]) {
              connections[socketListId] = new RTCPeerConnection(
                peerConnectionConfig,
              );
              //Wait for their ice candidate
              connections[socketListId].onicecandidate = function() {
                if (event.candidate != null) {
                  console.log('SENDING ICE');
                  socket.emit(
                    'signal',
                    socketListId,
                    JSON.stringify({
                      ice: event.candidate,
                    }),
                  );
                }
              };

              //Wait for their video stream
              connections[socketListId].onaddstream = function() {
                gotRemoteStream(event, socketListId);
              };

              //Add the local video stream
              connections[socketListId].addStream(localStream);
            }
          });

          //Create an offer to connect with your local description

          if (count >= 2) {
            connections[id].createOffer().then(function(description) {
              connections[id]
                .setLocalDescription(description)
                .then(function() {
                  // console.log(connections);
                  socket.emit(
                    'signal',
                    id,
                    JSON.stringify({
                      sdp: connections[id].localDescription,
                    }),
                  );
                })
                .catch(e => console.log(e));
            });
          }
        });
      });
    });
}

const printError = e => console.log(e);

function gotMessageFromServer(fromId, message) {
  //Parse the incoming signal
  let signal = JSON.parse(message);

  //Make sure it's not coming from yourself
  if (fromId != socketId) {
    if (signal.sdp) {
      connections[fromId]
        .setRemoteDescription(new RTCSessionDescription(signal.sdp))
        .then(() => {
          if (signal.sdp.type !== 'offer') return;
          connections[fromId]
            .createAnswer()
            .then(description => {
              connections[fromId]
                .setLocalDescription(description)
                .then(() => {
                  socket.emit(
                    'signal',
                    fromId,
                    JSON.stringify({
                      sdp: connections[fromId].localDescription,
                    }),
                  );
                })
                .catch(printError);
            })
            .catch(printError);
        })
        .catch(printError);
    }
    if (signal.ice) {
      connections[fromId]
        .addIceCandidate(new RTCIceCandidate(signal.ice))
        .catch(printError);
    }
  }
}

pageReady();
