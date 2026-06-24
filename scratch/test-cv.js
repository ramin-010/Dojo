const cv = require('@techstark/opencv-js');
cv.onRuntimeInitialized = () => {
  console.log(cv.Mat ? 'OpenCV is ready' : 'Not ready');
};
