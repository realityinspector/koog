import Foundation

public struct ISFShader: Equatable, Sendable {
    public var title: String
    public var inputs: [(name: String, value: Double)]
    public var metal: String

    public static func == (lhs: ISFShader, rhs: ISFShader) -> Bool {
        lhs.title == rhs.title && lhs.metal == rhs.metal && lhs.inputs.elementsEqual(rhs.inputs, by: { $0.name == $1.name && $0.value == $1.value })
    }
}

public enum ISFTranslator {
    /// Reads an ISF document (`/*{ json }*/` plus a GLSL `main`) and returns a Metal function
    /// `isf_main`. Texture lookups and most preprocessor logic are left for the Metal compiler to reject.
    public static func parse(_ source: String) -> ISFShader? {
        guard let headerStart = source.range(of: "/*"),
              let headerEnd = source.range(of: "*/"),
              headerStart.upperBound <= headerEnd.lowerBound else { return nil }
        let jsonText = String(source[headerStart.upperBound..<headerEnd.lowerBound])
        guard let jsonData = jsonText.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] else { return nil }
        let title = json["DESCRIPTION"] as? String ?? "ISF"
        var inputs: [(name: String, value: Double)] = []
        if let rawInputs = json["INPUTS"] as? [[String: Any]] {
            for item in rawInputs {
                let type = (item["TYPE"] as? String ?? "").lowercased()
                guard type == "float" || type == "long", let name = item["NAME"] as? String, !name.isEmpty else { continue }
                let value = (item["DEFAULT"] as? NSNumber)?.doubleValue ?? 0
                inputs.append((name, value))
                if inputs.count == 8 { break }
            }
        }
        let bodySource = String(source[headerEnd.upperBound...])
        guard let body = fragmentBody(bodySource) else { return nil }
        let metal = translate(body: body, inputs: inputs.map(\.name))
        return ISFShader(title: title, inputs: inputs, metal: metal)
    }

    private static func fragmentBody(_ source: String) -> String? {
        guard let main = source.range(of: "void main") else { return nil }
        let after = source[main.upperBound...]
        guard let open = after.firstIndex(of: "{") else { return nil }
        var depth = 0
        var index = open
        while index < after.endIndex {
            let character = after[index]
            if character == "{" { depth += 1 }
            if character == "}" {
                depth -= 1
                if depth == 0 { return String(after[after.index(after: open)..<index]) }
            }
            index = after.index(after: index)
        }
        return nil
    }

    private static func translate(body: String, inputs: [String]) -> String {
        var text = body
        let swaps = [
            ("vec2", "float2"), ("vec3", "float3"), ("vec4", "float4"),
            ("bvec2", "bool2"), ("bvec3", "bool3"), ("bvec4", "bool4"),
            ("mat2", "float2x2"), ("mat3", "float3x3"), ("mat4", "float4x4"),
            ("gl_FragColor", "outColor"),
            ("gl_FragCoord", "float4(isf_FragNormCoord * RENDERSIZE, 0.0, 1.0)"),
            ("mod(", "glsl_mod("),
        ]
        for (from, to) in swaps {
            text = text.replacingOccurrences(of: from, with: to)
        }
        text = text.replacingOccurrences(of: #"precision\s+\w+\s+\w+\s*;"#, with: "", options: .regularExpression)
        var declarations = ""
        for (index, name) in inputs.enumerated() {
            declarations += "    float \(name) = isfIn[\(index)];\n"
        }
        return """
        static float glsl_mod(float a, float b) { return a - b * floor(a / b); }
        static float2 glsl_mod(float2 a, float2 b) { return a - b * floor(a / b); }
        static float3 glsl_mod(float3 a, float3 b) { return a - b * floor(a / b); }

        float4 isf_main(float2 isf_FragNormCoord, float isf_TIME, float2 RENDERSIZE, constant float *isfIn) {
            float TIME = isf_TIME;
        \(declarations)    float4 outColor = float4(0.0);
        \(text)
            return outColor;
        }
        """
    }
}
