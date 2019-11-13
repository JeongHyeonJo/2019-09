const divSelectRoom = document.getElementById('selectRoom');
const divConsultingRoom = document.getElementById('consultingRoom');
const inputRoomNumber = document.getElementById('roomNumber');
const buttonGoRoom = document.getElementById('goRoom');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

let roomNumber;
let localStream;
let rtcPeerConnection;
const iceServers = {
  iceServers: [
    {
      urls: 'stun:stun.services.mozilla.com',
    },
    { urls: 'stun:stun.l.google.com:19302' },
  ],
};
const streamConstraints = { audio: true, video: true };
let isCaller;

const socket = io();

buttonGoRoom.onclick = () => {
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
    .catch((error) => {
      console.log('An error ocurred when accessing media devices', error);
    });
});

socket.on('joined', () => {
  navigator.mediaDevices
    .getUserMedia(streamConstraints)
    .then(() => {
      socket.emit('ready', roomNumber);
    })
    .catch((error) => {
      console.log('An error ocurred when accessing media devices', error);
    });
});

socket.on('candidate', (event) => {
  const candidate = new RTCIceCandidate({
    sdpMLineIndex: event.label,
    candidate: event.candidate,
  });
  rtcPeerConnection.addIceCandidate(candidate);
});

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
