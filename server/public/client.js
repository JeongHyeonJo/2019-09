// getting dom elements
const divSelectRoom = document.getElementById('selectRoom');
const divConsultingRoom = document.getElementById('consultingRoom');
const inputRoomNumber = document.getElementById('roomNumber');
const btnGoRoom = document.getElementById('goRoom');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

// variables
let roomNumber;
let localStream;
let remoteStream;
let rtcPeerConnection;
const iceServers = {
  iceServers: [
    { urls: 'stun:stun.services.mozilla.com' },
    { urls: 'stun:stun.l.google.com:19302' },
  ],
};
const streamConstraints = { audio: true, video: true };
let isCaller;

// Let's do this
const socket = io();

btnGoRoom.onclick = function () {
  if (inputRoomNumber.value === '') {
    alert('Please type a room number');
  } else {
    roomNumber = inputRoomNumber.value;
    socket.emit('create or join', roomNumber);
    divSelectRoom.style = 'display: none;';
    divConsultingRoom.style = 'display: block;';
  }
};

// message handlers
socket.on('created', () => {
  navigator.mediaDevices
    .getUserMedia(streamConstraints)
    .then((stream) => {
      localStream = stream;
      localVideo.srcObject = stream;
      isCaller = true;
    })
    .catch((err) => {
      console.log('An error ocurred when accessing media devices', err);
    });
});

socket.on('joined', () => {
  navigator.mediaDevices
    .getUserMedia(streamConstraints)
    .then((stream) => {
      localStream = stream;
      localVideo.srcObject = stream;
      socket.emit('ready', roomNumber);
    })
    .catch((err) => {
      console.log('An error ocurred when accessing media devices', err);
    });
});

socket.on('candidate', (event) => {
  const candidate = new RTCIceCandidate({
    sdpMLineIndex: event.label,
    candidate: event.candidate,
  });
  rtcPeerConnection.addIceCandidate(candidate);
});

// handler functions
function onIceCandidate(event) {
  if (event.candidate) {
    console.log('sending ice candidate');
    socket.emit('candidate', {
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate,
      room: roomNumber,
    });
  }
}

function onAddStream(event) {
  [remoteVideo.srcObject] = event.streams;
  remoteStream = event.stream;
}

socket.on('ready', () => {
  if (isCaller) {
    rtcPeerConnection = new RTCPeerConnection(iceServers);
    rtcPeerConnection.onicecandidate = onIceCandidate;
    rtcPeerConnection.ontrack = onAddStream;
    rtcPeerConnection.addTrack(localStream.getTracks()[0], localStream);
    rtcPeerConnection.addTrack(localStream.getTracks()[1], localStream);
    rtcPeerConnection
      .createOffer()
      .then((sessionDescription) => {
        rtcPeerConnection.setLocalDescription(sessionDescription);
        socket.emit('offer', {
          type: 'offer',
          sdp: sessionDescription,
          room: roomNumber,
        });
      })
      .catch((error) => {
        console.log(error);
      });
  }
});

socket.on('offer', (event) => {
  if (!isCaller) {
    rtcPeerConnection = new RTCPeerConnection(iceServers);
    rtcPeerConnection.onicecandidate = onIceCandidate;
    rtcPeerConnection.ontrack = onAddStream;
    rtcPeerConnection.addTrack(localStream.getTracks()[0], localStream);
    rtcPeerConnection.addTrack(localStream.getTracks()[1], localStream);
    rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(event));
    rtcPeerConnection
      .createAnswer()
      .then((sessionDescription) => {
        rtcPeerConnection.setLocalDescription(sessionDescription);
        socket.emit('answer', {
          type: 'answer',
          sdp: sessionDescription,
          room: roomNumber,
        });
      })
      .catch((error) => {
        console.log(error);
      });
  }
});

socket.on('answer', (event) => {
  rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(event));
});
