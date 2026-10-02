import Foundation
#if canImport(FoundationModels)
import FoundationModels
#endif

func fail(_ code: String, _ message: String) {
    let data = try! JSONSerialization.data(withJSONObject: ["code": code, "message": message])
    print(String(decoding: data, as: UTF8.self))
}

#if canImport(FoundationModels)
if #available(macOS 26.0, *) {
    switch SystemLanguageModel.default.availability {
    case .available:
        do {
            let data = FileHandle.standardInput.readDataToEndOfFile()
            guard data.count <= 64 * 1024, let prompt = String(data: data, encoding: .utf8) else {
                fail("invalid_request", "Conversation input is too large or unreadable.")
                exit(0)
            }
            guard let boundary = prompt.range(of: "\nConversation data JSON: ") else {
                fail("invalid_request", "Conversation input has no context data.")
                exit(0)
            }
            let instructions = String(prompt[..<boundary.lowerBound])
            let context = String(prompt[boundary.upperBound...])
            let root = DynamicGenerationSchema(name: "ConversationTurn", properties: [
                .init(name: "spoken_reply", description: "One short statement, no question, at most 30 words and 180 characters.", schema: .init(type: String.self)),
                .init(name: "question", description: "Exactly one simple question ending in ?, at most 20 words and 140 characters.", schema: .init(type: String.self)),
                .init(name: "session_phase", schema: .init(name: "Phase", anyOf: ["active"])),
                .init(name: "is_complete", description: "Always false.", schema: .init(type: Bool.self))
            ])
            let schema = try GenerationSchema(root: root, dependencies: [])
            let response = try await LanguageModelSession(instructions: instructions).respond(to: "Continue from this conversation data JSON: \(context)", schema: schema)
            print(response.content.jsonString)
        } catch {
            fail("process_failed", "Apple could not generate this reply. Retry or choose Antigravity in Settings.")
        }
    case .unavailable(let reason):
        switch reason {
        case .appleIntelligenceNotEnabled:
            fail("unavailable", "Enable Apple Intelligence in System Settings and match your Mac and Siri languages.")
        case .modelNotReady:
            fail("unavailable", "Apple is still downloading its local model. Try again after the download finishes.")
        case .deviceNotEligible:
            fail("unavailable", "This Mac does not support Apple Intelligence. Choose Antigravity in Settings.")
        @unknown default:
            fail("unavailable", "Apple Intelligence is unavailable. Check System Settings or choose Antigravity.")
        }
    }
} else {
    fail("unavailable", "Apple conversation requires macOS 26 or later. Choose Antigravity in Settings.")
}
#else
fail("unavailable", "This build has no Apple model support. Use a build made with the macOS 26 SDK or choose Antigravity.")
#endif
