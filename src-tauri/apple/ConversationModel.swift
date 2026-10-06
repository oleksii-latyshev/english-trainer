import Foundation
#if canImport(FoundationModels)
import FoundationModels
#endif

// Long-lived helper: one JSON request per stdin line, JSON events per stdout line.
// Request:  {"id": 1, "instructions": "...", "prompt": "..."}
// Events:   {"id": 1, "type": "delta", "text": "..."} | {"id": 1, "type": "done"}
//           | {"id": 1, "type": "error", "code": "...", "message": "..."}

func emit(_ event: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: event) else { return }
    FileHandle.standardOutput.write(data + Data([0x0A]))
}

func emitError(_ id: Int, _ code: String, _ message: String) {
    emit(["id": id, "type": "error", "code": code, "message": message])
}

struct Request {
    let id: Int
    let instructions: String
    let prompt: String
}

func parseRequest(_ line: String) -> Request? {
    guard let data = line.data(using: .utf8),
          data.count <= 64 * 1024,
          let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let id = object["id"] as? Int,
          let instructions = object["instructions"] as? String,
          let prompt = object["prompt"] as? String
    else { return nil }
    return Request(id: id, instructions: instructions, prompt: prompt)
}

func serve(unavailable: (String, String)?, handle: (Request) async -> Void) async {
    while let line = readLine() {
        guard let request = parseRequest(line) else {
            emitError(0, "invalid_request", "Conversation input is too large or unreadable.")
            continue
        }
        if let (code, message) = unavailable {
            emitError(request.id, code, message)
            continue
        }
        await handle(request)
    }
}

#if canImport(FoundationModels)
if #available(macOS 26.0, *) {
    var unavailable: (String, String)? = nil
    switch SystemLanguageModel.default.availability {
    case .available:
        // Loads the on-device model before the first request arrives.
        LanguageModelSession(instructions: "Reply in English.").prewarm()
    case .unavailable(let reason):
        switch reason {
        case .appleIntelligenceNotEnabled:
            unavailable = ("unavailable", "Enable Apple Intelligence in System Settings and match your Mac and Siri languages.")
        case .modelNotReady:
            unavailable = ("unavailable", "Apple is still downloading its local model. Try again after the download finishes.")
        case .deviceNotEligible:
            unavailable = ("unavailable", "This Mac does not support Apple Intelligence. Choose Gemini or Antigravity in Settings.")
        @unknown default:
            unavailable = ("unavailable", "Apple Intelligence is unavailable. Check System Settings or choose Gemini or Antigravity.")
        }
    }
    await serve(unavailable: unavailable) { request in
        do {
            let session = LanguageModelSession(instructions: request.instructions)
            var emitted = ""
            for try await snapshot in session.streamResponse(to: request.prompt) {
                // Snapshots are cumulative; send only the new suffix.
                let text = snapshot.content
                guard text.hasPrefix(emitted), text.count > emitted.count else { continue }
                emit(["id": request.id, "type": "delta", "text": String(text.dropFirst(emitted.count))])
                emitted = text
            }
            emit(["id": request.id, "type": "done"])
        } catch {
            emitError(request.id, "process_failed", "Apple could not generate this reply. Retry or choose Gemini or Antigravity in Settings.")
        }
    }
} else {
    await serve(unavailable: ("unavailable", "Apple conversation requires macOS 26 or later. Choose Gemini or Antigravity in Settings.")) { _ in }
}
#else
await serve(unavailable: ("unavailable", "This build has no Apple model support. Use a build made with the macOS 26 SDK or choose Gemini or Antigravity.")) { _ in }
#endif
