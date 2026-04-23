/**
 * Offscreen Document - renders tabCapture video stream to a JPEG canvas image
 * Receives streamId from background.js, captures a single frame, returns dataURL
 */

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let activeStream = null;
let captureTimeout = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'capture') {
    // Capture a frame from the tabCapture stream
    captureFrame(msg.streamId, msg.width, msg.height)
      .then(dataUrl => {
        chrome.runtime.sendMessage({
          type: 'captureResult',
          streamId: msg.streamId,
          success: true,
          dataUrl
        });
        sendResponse({ ok: true });
      })
      .catch(err => {
        chrome.runtime.sendMessage({
          type: 'captureResult',
          streamId: msg.streamId,
          success: false,
          error: err.message
        });
        sendResponse({ ok: false, error: err.message });
      });
    return true; // async response
  }
});

async function captureFrame(streamId, width, height) {
  // Stop any previous capture
  stopCurrentCapture();

  const w = width || 400;
  const h = height || 250;

  // Create a hidden video element to receive the stream
  const video = document.createElement('video');
  video.style.cssText = 'position:fixed;opacity:0;pointer-events:none;left:-9999px;top:-9999px;';
  video.autoplay = true;
  video.playsInline = true;
  document.body.appendChild(video);

  return new Promise((resolve, reject) => {
    // The streamId comes from chrome.tabCapture.capture() which gives us
    // a MediaStream. We use getUserMedia with chromeMediaSource=tab to
    // attach to that stream.
    const constraints = {
      video: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId,
          maxWidth: w,
          maxHeight: h,
          maxFrameRate: 5
        }
      },
      audio: false
    };

    navigator.mediaDevices.getUserMedia(constraints)
      .then(stream => {
        activeStream = stream;
        const track = stream.getVideoTracks()[0];
        video.srcObject = stream;

        const timeout = setTimeout(() => {
          stopCurrentCapture();
          video.remove();
          reject(new Error('Video loadedmetadata timeout'));
        }, 3000);

        video.onloadedmetadata = () => {
          video.play().then(() => {
            // Give it a moment to render the first frame
            setTimeout(() => {
              try {
                canvas.width = w;
                canvas.height = h;
                ctx.drawImage(video, 0, 0, w, h);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                stopCurrentCapture();
                video.remove();
                resolve(dataUrl);
              } catch (e) {
                stopCurrentCapture();
                video.remove();
                reject(e);
              }
            }, 200);
          }).catch(e => {
            stopCurrentCapture();
            video.remove();
            reject(e);
          });
        };

        video.onerror = () => {
          clearTimeout(timeout);
          stopCurrentCapture();
          video.remove();
          reject(new Error('Video error'));
        };
      })
      .catch(err => {
        stopCurrentCapture();
        video.remove();
        reject(err);
      });
  });
}

function stopCurrentCapture() {
  if (activeStream) {
    activeStream.getTracks().forEach(t => t.stop());
    activeStream = null;
  }
}
