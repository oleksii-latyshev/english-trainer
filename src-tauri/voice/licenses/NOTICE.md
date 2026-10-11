# Bundled local speech

English Trainer uses Supertonic 3 INT8 through sherpa-onnx 1.13.8 and ONNX Runtime.
The pinned, quantized model is supplied by sherpa-onnx; the original model and voice styles are
from Supertone. The model is governed by `supertonic-model.txt`, including its use restrictions
in Attachment A. Users of this bundled model must comply with those terms. The sample code's
MIT license is separate from the model license.

The runtime is a separate helper, accessed through stdin/stdout. It includes sherpa-onnx's
speech dependencies (including eSpeak NG); their license notices are supplied here even though
Supertonic does not use eSpeak phonemization. Upstream source and build instructions:

- https://github.com/k2-fsa/sherpa-onnx/tree/v1.13.8
- https://github.com/microsoft/onnxruntime
- https://github.com/espeak-ng/espeak-ng/tree/1.52.0
- https://github.com/supertone-oss-archive/supertonic
- https://huggingface.co/supertone-oss-archive/supertonic-3

Supertonic's original repository is archived. English Trainer pins the model and uses the
maintained sherpa-onnx inference adapter; model updates require explicit benchmark and review.
The app does not download models, call a cloud speech API, clone voices, or retain generated
speech. Only the developer's asset preparation step downloads pinned model/runtime archives.
