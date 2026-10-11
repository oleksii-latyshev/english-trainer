// A persistent, binary-framed adapter keeps model loading outside conversation turns.
#include <sherpa-onnx/c-api/c-api.h>
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

static bool read(void* data, size_t size) { return std::fread(data, 1, size, stdin) == size; }
static void put(std::vector<uint8_t>& out, uint32_t value, int bytes) {
  for (int i = 0; i < bytes; ++i) out.push_back((value >> (i * 8)) & 255);
}
static void literal(std::vector<uint8_t>& out, const char* value) {
  out.insert(out.end(), value, value + 4);
}
static std::vector<uint8_t> wave(const SherpaOnnxGeneratedAudio& audio) {
  std::vector<uint8_t> out;
  out.reserve(44 + audio.n * 2);
  literal(out, "RIFF"); put(out, 36 + audio.n * 2, 4); literal(out, "WAVE");
  literal(out, "fmt "); put(out, 16, 4); put(out, 1, 2); put(out, 1, 2);
  put(out, audio.sample_rate, 4); put(out, audio.sample_rate * 2, 4);
  put(out, 2, 2); put(out, 16, 2); literal(out, "data"); put(out, audio.n * 2, 4);
  for (int i = 0; i < audio.n; ++i) {
    float sample = std::isfinite(audio.samples[i]) ? audio.samples[i] : 0;
    int16_t pcm = static_cast<int16_t>(std::clamp(sample, -1.f, 1.f) * 32767);
    put(out, static_cast<uint16_t>(pcm), 2);
  }
  return out;
}
int main(int argc, char** argv) {
  if (argc != 2) return 1;
  std::string p = argv[1];
  std::string dp=p+"/duration_predictor.int8.onnx", te=p+"/text_encoder.int8.onnx",
    ve=p+"/vector_estimator.int8.onnx", vc=p+"/vocoder.int8.onnx",
    tj=p+"/tts.json", ui=p+"/unicode_indexer.bin", vs=p+"/voice.bin";
  SherpaOnnxOfflineTtsConfig config{};
  config.model.num_threads=2; config.model.provider="cpu"; config.max_num_sentences=1;
  auto& model=config.model.supertonic;
  model.duration_predictor=dp.c_str(); model.text_encoder=te.c_str();
  model.vector_estimator=ve.c_str(); model.vocoder=vc.c_str();
  model.tts_json=tj.c_str(); model.unicode_indexer=ui.c_str(); model.voice_style=vs.c_str();
  const auto* engine=SherpaOnnxCreateOfflineTts(&config);
  if (!engine) return 2;
  uint32_t ready=0x31535454; // TTS1; framing is little-endian on supported Apple Silicon.
  std::fwrite(&ready, 4, 1, stdout); std::fflush(stdout);
  uint32_t size, speaker; float speed;
  while (read(&size, 4)) {
    if (size == 0 || size > 4096 || !read(&speaker, 4) || !read(&speed, 4)) break;
    if (speaker > 9 || !std::isfinite(speed) || speed < .85f || speed > 1.2f) break;
    std::string text(size, '\0');
    if (!read(text.data(), size) || text.find('\0') != std::string::npos) break;
    SherpaOnnxGenerationConfig generation{};
    generation.sid=speaker; generation.speed=speed; generation.num_steps=5;
    generation.extra="{\"lang\":\"en\"}";
    const auto* audio=SherpaOnnxOfflineTtsGenerateWithConfig(engine, text.c_str(), &generation, nullptr, nullptr);
    if (!audio || audio->n <= 0 || audio->n > 44100 * 60) {
      if (audio) SherpaOnnxDestroyOfflineTtsGeneratedAudio(audio);
      break;
    }
    auto wav=wave(*audio); SherpaOnnxDestroyOfflineTtsGeneratedAudio(audio);
    size=wav.size(); std::fwrite(&size, 4, 1, stdout);
    std::fwrite(wav.data(), 1, wav.size(), stdout); std::fflush(stdout);
  }
  SherpaOnnxDestroyOfflineTts(engine);
}
