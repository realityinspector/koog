import MetalKit
import SwiftUI
import ProVizKit

enum CanvasShader {
    static let defaultISF = """
    float4 isf_main(float2 isf_FragNormCoord, float isf_TIME, float2 RENDERSIZE, constant float *isfIn) {
        return float4(isf_FragNormCoord, 0.35 + 0.15 * sin(isf_TIME), 1.0);
    }
    """

    static func source(isf: String) -> String {
        let body = isf.isEmpty ? defaultISF : isf
        return template.replacingOccurrences(of: "/*ISF*/", with: body)
    }

    private static let template = """
    #include <metal_stdlib>
    using namespace metal;

    constant int VB_HEADER = 48;
    constant int VB_STRIDE = 36;
    constant int VB_BLENDS = 8;

    struct VOut {
        float4 position [[position]];
        float2 uv;
    };

    vertex VOut vs_main(uint id [[vertex_id]]) {
        float2 corners[3] = { float2(-1.0, -1.0), float2(3.0, -1.0), float2(-1.0, 3.0) };
        VOut out;
        out.position = float4(corners[id], 0.0, 1.0);
        out.uv = corners[id] * 0.5 + 0.5;
        out.uv.y = 1.0 - out.uv.y;
        return out;
    }

    /*ISF*/

    float cross2(float2 p, float2 q) { return p.x * q.y - p.y * q.x; }

    float2 invBilinear(float2 p, float2 a, float2 b, float2 c, float2 d) {
        float2 e = b - a;
        float2 f = d - a;
        float2 g = a - b + c - d;
        float2 h = p - a;
        float k2 = cross2(g, f);
        float k1 = cross2(e, f) + cross2(h, g);
        float k0 = cross2(h, e);
        float v;
        if (abs(k2) < 1e-4) {
            v = -k0 / max(1e-4, k1);
        } else {
            float disc = k1 * k1 - 4.0 * k2 * k0;
            if (disc < 0.0) return p;
            float root = sqrt(disc);
            float v1 = (-k1 + root) / (2.0 * k2);
            float v2 = (-k1 - root) / (2.0 * k2);
            v = (v1 >= 0.0 && v1 <= 1.0) ? v1 : v2;
        }
        float denomX = e.x + g.x * v;
        float denomY = e.y + g.y * v;
        float uu = abs(denomX) >= abs(denomY) ? (h.x - f.x * v) / denomX : (h.y - f.y * v) / denomY;
        return float2(uu, v);
    }

    float3 hsv(float h, float s, float v) {
        float3 p = abs(fract(float3(h) + float3(0.0, 0.6666667, 0.3333333)) * 6.0 - 3.0) - 1.0;
        return v * mix(float3(1.0), clamp(p, 0.0, 1.0), s);
    }

    float3 drawLayer(float2 p, float hue, float warp, float phase, float shader, float stem,
                     float audioAmt, float hit, float bass, float mid, float treble, float deckHue) {
        float useB = (stem < 0.5 || stem > 2.5) ? 1.0 : 0.15;
        float useM = ((stem > 0.5 && stem < 1.5) || stem > 2.5) ? 1.0 : 0.15;
        float useT = ((stem > 1.5 && stem < 2.5) || stem > 2.5) ? 1.0 : 0.15;
        float energy = bass * useB + mid * useM + treble * useT;
        float punch = 1.0 + energy * audioAmt * 0.5 + hit * 0.45;
        float2 q = p / max(0.35, punch);
        float r = length(q);
        float ang = atan2(q.y, q.x);
        int mode = int(shader * 4.0 + 0.5);
        float v = 0.0;
        if (mode == 0) {
            float rings = sin(r * (9.0 + warp * 26.0) - phase * 6.28318);
            float spokes = sin(ang * (4.0 + warp * 7.0) + phase * 2.0);
            v = smoothstep(-0.15, 0.9, rings * 0.65 + spokes * 0.35);
        } else if (mode == 1) {
            float2 g = abs(fract(q * (3.5 + warp * 8.0) + float2(phase, phase * 0.6)) - 0.5);
            v = smoothstep(0.07, 0.0, min(g.x, g.y));
        } else if (mode == 2) {
            float b1 = smoothstep(0.14, 0.0, abs(q.y + 0.34)) * (0.2 + bass * useB);
            float b2 = smoothstep(0.14, 0.0, abs(q.y)) * (0.2 + mid * useM);
            float b3 = smoothstep(0.14, 0.0, abs(q.y - 0.34)) * (0.2 + treble * useT);
            v = clamp(b1 + b2 + b3, 0.0, 1.0);
        } else if (mode == 3) {
            float fold = abs(fract((ang / 3.1415926) * (3.0 + warp * 5.0) + phase) - 0.5);
            v = smoothstep(0.35, 0.0, abs(fold * 2.2 - r));
        } else {
            float scan = smoothstep(0.045, 0.0, abs(fract(q.y * (2.0 + warp * 12.0) - phase) - 0.5));
            v = scan * (0.35 + 0.65 * (0.5 + 0.5 * sin(q.x * 18.0 + phase * 9.0)));
        }
        return hsv(fract(hue * 0.35 + deckHue + energy * 0.05), 0.72, v);
    }

    int fxKind(float unit) { return int(unit * 10.0 + 0.5); }

    float2 placed(float2 uv, float x, float y, float scale, float rotation, float ax, float ay) {
        float2 q = uv - float2(x, y);
        float ang = (rotation - 0.5) * 6.2831853;
        float s = sin(ang);
        float c = cos(ang);
        q = float2(c * q.x - s * q.y, s * q.x + c * q.y);
        q /= max(0.05, scale * 2.0);
        return q + float2(ax, ay);
    }

    float2 fitUV(float2 uv, float fit, float lock, float sourceAspect, float canvasAspect) {
        int mode = int(fit * 2.0 + 0.5);
        if (lock > 0.5 && mode == 2) mode = 0;
        if (mode >= 2) return uv;
        float ratio = max(0.05, sourceAspect) / max(0.05, canvasAspect);
        if (mode == 0) {
            if (ratio > 1.0) uv.y = (uv.y - 0.5) * ratio + 0.5;
            else uv.x = (uv.x - 0.5) / ratio + 0.5;
        } else if (ratio > 1.0) {
            uv.x = (uv.x - 0.5) / ratio + 0.5;
        } else {
            uv.y = (uv.y - 0.5) * ratio + 0.5;
        }
        return uv;
    }

    float2 warpUV(float2 uv, float kind, float amt, float time) {
        int k = fxKind(kind);
        if (k == 3) {
            float cells = mix(140.0, 8.0, amt);
            return floor(uv * cells) / cells;
        }
        if (k == 4) {
            uv.x += sin(uv.y * 28.0 + time * 2.0) * amt * 0.05;
            return uv;
        }
        if (k == 10) {
            float band = floor(uv.y * mix(6.0, 28.0, amt));
            float jump = fract(sin(band * 12.9898 + floor(time * 10.0)) * 43758.5453) - 0.5;
            uv.x += jump * amt * 0.35;
        }
        return uv;
    }

    float3 gradeColor(float3 rgb, float kind, float amt) {
        int k = fxKind(kind);
        if (k == 2) {
            float contrast = mix(0.6, 2.2, amt);
            return clamp((rgb - 0.5) * contrast + 0.5, 0.0, 1.0);
        }
        if (k == 5) {
            return mix(rgb, 1.0 - rgb, amt);
        }
        if (k == 8) {
            return mix(rgb, float3(rgb.r, rgb.b, rgb.g), amt * 0.85);
        }
        return rgb;
    }

    float3 applyGrade(float3 rgb, float grade) {
        int g = int(grade * 4.0 + 0.5);
        if (g == 1) return clamp(pow(max(rgb, 0.0), float3(0.92, 1.0, 1.12)) * float3(1.06, 0.98, 0.9), 0.0, 1.0);
        if (g == 2) return clamp(rgb * float3(0.9, 0.98, 1.12), 0.0, 1.0);
        if (g == 3) {
            float luma = dot(rgb, float3(0.3, 0.59, 0.11));
            return clamp(mix(rgb, float3(luma), 0.45) * float3(1.08, 1.04, 0.96), 0.0, 1.0);
        }
        if (g == 4) return clamp((rgb - 0.5) * 1.55 + 0.5, 0.0, 1.0);
        return rgb;
    }

    float4 sampleLayer(int index, float2 uv, texture2d<float> t0, texture2d<float> t1, texture2d<float> t2, texture2d<float> t3, texture2d<float> t4, texture2d<float> t5, texture2d<float> t6, texture2d<float> t7, sampler samp) {
        if (index == 0) return t0.sample(samp, uv);
        if (index == 1) return t1.sample(samp, uv);
        if (index == 2) return t2.sample(samp, uv);
        if (index == 3) return t3.sample(samp, uv);
        if (index == 4) return t4.sample(samp, uv);
        if (index == 5) return t5.sample(samp, uv);
        if (index == 6) return t6.sample(samp, uv);
        return t7.sample(samp, uv);
    }

    float3 blendOver(int mode, float3 base, float3 over) {
        if (mode == 1) return base + over;
        if (mode == 2) return base * over;
        if (mode == 3) return 1.0 - (1.0 - base) * (1.0 - over);
        if (mode == 4) return min(base, over);
        if (mode == 5) return max(base, over);
        if (mode == 6) {
            float3 low = 2.0 * base * over;
            float3 high = 1.0 - 2.0 * (1.0 - base) * (1.0 - over);
            return mix(low, high, step(float3(0.5), base));
        }
        if (mode == 7) return abs(base - over);
        if (mode == 8) return base + over - 2.0 * base * over;
        return over;
    }

    float4 shade(int i, float2 uv, constant float *u,
                 texture2d<float> t0, texture2d<float> t1, texture2d<float> t2, texture2d<float> t3,
                 texture2d<float> t4, texture2d<float> t5, texture2d<float> t6, texture2d<float> t7,
                 texture2d<float> fb, sampler samp) {
        int base = VB_HEADER + i * VB_STRIDE;
        float opacity = u[base];
        if (opacity < 0.004) return float4(0.0);
        int pass = int(u[35] + 0.5);
        int target = int(u[base + 29] * 2.0 + 0.5);
        if (target != pass) return float4(0.0);
        float2 local = placed(uv, u[base + 10], u[base + 11], u[base + 12], u[base + 13], u[base + 21], u[base + 22]);
        float edge = min(min(local.x, 1.0 - local.x), min(local.y, 1.0 - local.y));
        float soft = u[base + 27] < 0.001 ? 1.0 : smoothstep(0.0, u[base + 27] * 0.22, edge);
        if (local.x < 0.0 || local.y < 0.0 || local.x > 1.0 || local.y > 1.0) return float4(0.0);
        local = fitUV(local, u[base + 20], u[base + 28], max(0.05, u[base + 32]), max(0.05, u[7]));
        if (local.x < 0.0 || local.y < 0.0 || local.x > 1.0 || local.y > 1.0) return float4(0.0);
        float left = min(u[base + 23], 0.45);
        float right = min(u[base + 24], 0.45);
        float top = min(u[base + 25], 0.45);
        float bottom = min(u[base + 26], 0.45);
        local = float2(mix(left, 1.0 - right, local.x), mix(top, 1.0 - bottom, local.y));
        local = warpUV(local, u[base + 16], u[base + 17], u[0]);
        local = warpUV(local, u[base + 18], u[base + 19], u[0]);
        local = warpUV(local, u[base + 30], u[base + 31], u[0]);
        int source = int(u[base + 15] * 6.0 + 0.5);
        float3 rgb = float3(0.0);
        float alpha = 1.0;
        bool blur = fxKind(u[base + 16]) == 1 || fxKind(u[base + 18]) == 1 || fxKind(u[base + 30]) == 1;
        float blurAmt = fxKind(u[base + 16]) == 1 ? u[base + 17] : (fxKind(u[base + 18]) == 1 ? u[base + 19] : u[base + 31]);
        if (source >= 1 && source <= 4) {
            float4 s = sampleLayer(i, local, t0, t1, t2, t3, t4, t5, t6, t7, samp);
            if (blur) {
                float o = 0.004 + blurAmt * 0.02;
                s += sampleLayer(i, local + float2(o, 0.0), t0, t1, t2, t3, t4, t5, t6, t7, samp);
                s += sampleLayer(i, local - float2(o, 0.0), t0, t1, t2, t3, t4, t5, t6, t7, samp);
                s += sampleLayer(i, local + float2(0.0, o), t0, t1, t2, t3, t4, t5, t6, t7, samp);
                s += sampleLayer(i, local - float2(0.0, o), t0, t1, t2, t3, t4, t5, t6, t7, samp);
                s *= 0.2;
            }
            rgb = s.rgb;
            alpha = s.a;
        } else if (source == 5) {
            float2 fuv = (local - 0.5) / max(0.25, mix(0.55, 1.45, u[15])) + 0.5;
            rgb = fb.sample(samp, fuv).rgb;
        } else if (source == 6) {
            float4 s = isf_main(local, u[0], float2(max(1.0, u[25]), max(1.0, u[26])), u + 27);
            rgb = s.rgb;
            alpha = s.a;
        } else {
            float aspect = max(0.5, u[7]);
            float2 p = (local - 0.5) * float2(aspect, 1.0);
            float deckHue = i == 0 ? 0.55 : (i == 1 ? 0.08 : 0.3 + float(i) * 0.07);
            rgb = drawLayer(p, u[base + 2], u[base + 3], u[base + 4], u[base + 7], u[base + 8], u[base + 9], u[base + 6], u[3], u[4], u[5], deckHue);
            if (blur) {
                float o = 0.02 + blurAmt * 0.05;
                rgb += drawLayer(p + float2(o, 0.0), u[base + 2], u[base + 3], u[base + 4], u[base + 7], u[base + 8], u[base + 9], u[base + 6], u[3], u[4], u[5], deckHue);
                rgb += drawLayer(p - float2(o, 0.0), u[base + 2], u[base + 3], u[base + 4], u[base + 7], u[base + 8], u[base + 9], u[base + 6], u[3], u[4], u[5], deckHue);
                rgb *= 0.333;
            }
            rgb *= u[base + 5] > 0.5 ? 1.0 : 0.45;
        }
        rgb = gradeColor(rgb, u[base + 16], u[base + 17]);
        rgb = gradeColor(rgb, u[base + 18], u[base + 19]);
        rgb = gradeColor(rgb, u[base + 30], u[base + 31]);
        if ((fxKind(u[base + 16]) == 9 || fxKind(u[base + 18]) == 9 || fxKind(u[base + 30]) == 9) && source >= 1 && source <= 4) {
            float amount = fxKind(u[base + 16]) == 9 ? u[base + 17] : (fxKind(u[base + 18]) == 9 ? u[base + 19] : u[base + 31]);
            float o = 0.002 + amount * 0.006;
            float3 luma = float3(0.3, 0.59, 0.11);
            float gx = dot(sampleLayer(i, local + float2(o, 0.0), t0, t1, t2, t3, t4, t5, t6, t7, samp).rgb, luma);
            gx -= dot(sampleLayer(i, local - float2(o, 0.0), t0, t1, t2, t3, t4, t5, t6, t7, samp).rgb, luma);
            float gy = dot(sampleLayer(i, local + float2(0.0, o), t0, t1, t2, t3, t4, t5, t6, t7, samp).rgb, luma);
            gy -= dot(sampleLayer(i, local - float2(0.0, o), t0, t1, t2, t3, t4, t5, t6, t7, samp).rgb, luma);
            float edgeAmt = clamp(length(float2(gx, gy)) * 6.0, 0.0, 1.0);
            rgb = mix(rgb, float3(edgeAmt), amount);
        }
        if (source >= 1 && source <= 4 && (fxKind(u[base + 16]) == 8 || fxKind(u[base + 18]) == 8 || fxKind(u[base + 30]) == 8)) {
            float amount = fxKind(u[base + 16]) == 8 ? u[base + 17] : (fxKind(u[base + 18]) == 8 ? u[base + 19] : u[base + 31]);
            float shift = amount * 0.018;
            float red = sampleLayer(i, local + float2(shift, 0.0), t0, t1, t2, t3, t4, t5, t6, t7, samp).r;
            float blue = sampleLayer(i, local - float2(shift, 0.0), t0, t1, t2, t3, t4, t5, t6, t7, samp).b;
            rgb = mix(rgb, float3(red, rgb.g, blue), amount);
        }
        rgb = applyGrade(rgb, u[base + 33]);
        return float4(rgb, opacity * alpha * soft);
    }

    float3 paintStack(float2 uv, constant float *u, bool wipeDecks,
                      texture2d<float> t0, texture2d<float> t1, texture2d<float> t2, texture2d<float> t3,
                      texture2d<float> t4, texture2d<float> t5, texture2d<float> t6, texture2d<float> t7,
                      texture2d<float> fb, sampler samp) {
        float aspect = max(0.5, u[7]);
        float2 zoomed = (uv - 0.5) * mix(1.15, 0.42, u[8]) + 0.5;
        float2 p = (zoomed - 0.5) * float2(aspect, 1.0);
        float cut = mix(aspect, -aspect, u[1]);
        float wipe = smoothstep(cut - 0.02, cut + 0.02, p.x);
        float edge = smoothstep(0.05, 0.0, abs(p.x - cut)) * u[9];
        float3 col = float3(0.0);
        bool placed = false;
        bool decksDrawn = false;
        for (int s = 0; s < 8; s++) {
            int i = int(u[40 + s] + 0.5);
            if (i < 0 || i > 7) continue;
            if (wipeDecks && (i == 0 || i == 1)) {
                if (decksDrawn) continue;
                decksDrawn = true;
                float4 a = shade(0, zoomed, u, t0, t1, t2, t3, t4, t5, t6, t7, fb, samp);
                float4 b = shade(1, zoomed, u, t0, t1, t2, t3, t4, t5, t6, t7, fb, samp);
                if (a.a < 0.004 && b.a < 0.004) continue;
                float3 plate;
                float cover;
                if (a.a < 0.004) {
                    plate = b.rgb;
                    cover = b.a;
                } else if (b.a < 0.004) {
                    plate = a.rgb;
                    cover = a.a;
                } else {
                    plate = mix(a.rgb, b.rgb, wipe);
                    plate += edge * float3(1.0, 0.82, 0.45);
                    cover = mix(a.a, b.a, wipe);
                }
                col = placed ? mix(col, plate, clamp(cover, 0.0, 1.0)) : plate;
                placed = true;
                continue;
            }
            float4 over = shade(i, zoomed, u, t0, t1, t2, t3, t4, t5, t6, t7, fb, samp);
            if (over.a < 0.004) continue;
            int mode = int(u[VB_HEADER + i * VB_STRIDE + 14] * float(VB_BLENDS) + 0.5);
            col = placed ? mix(col, blendOver(mode, col, over.rgb), over.a) : over.rgb;
            placed = true;
        }
        return col;
    }

    float3 composite(float2 uv, constant float *u, bool stack,
                     texture2d<float> t0, texture2d<float> t1, texture2d<float> t2, texture2d<float> t3,
                     texture2d<float> t4, texture2d<float> t5, texture2d<float> t6, texture2d<float> t7,
                     texture2d<float> fb, sampler samp) {
        return paintStack(uv, u, stack, t0, t1, t2, t3, t4, t5, t6, t7, fb, samp);
    }

    float3 stackCanvas(float2 uv, constant float *u,
                       texture2d<float> t0, texture2d<float> t1, texture2d<float> t2, texture2d<float> t3,
                       texture2d<float> t4, texture2d<float> t5, texture2d<float> t6, texture2d<float> t7,
                       texture2d<float> fb, sampler samp) {
        return paintStack(uv, u, false, t0, t1, t2, t3, t4, t5, t6, t7, fb, samp);
    }

    float3 finishProgram(float2 uv, constant float *u,
                         texture2d<float> c0, texture2d<float> c1, texture2d<float> c2,
                         texture2d<float> fb, sampler samp) {
        float2 sampleUV = uv;
        if (u[16] > 0.5) {
            sampleUV = invBilinear(uv, float2(u[17], u[18]), float2(u[19], u[20]), float2(u[21], u[22]), float2(u[23], u[24]));
        }
        float3 mainColor = c0.sample(samp, sampleUV).rgb;
        float3 canvasB = c1.sample(samp, sampleUV).rgb;
        float3 canvasC = c2.sample(samp, sampleUV).rgb;
        float3 col = mix(mainColor, blendOver(int(u[37] * float(VB_BLENDS) + 0.5), mainColor, canvasB), clamp(u[36], 0.0, 1.0));
        col = mix(col, blendOver(int(u[39] * float(VB_BLENDS) + 0.5), col, canvasC), clamp(u[38], 0.0, 1.0));
        float2 fuv = (uv - 0.5) / max(0.25, mix(0.55, 1.45, u[15])) + 0.5;
        col = mix(col, fb.sample(samp, fuv).rgb, clamp(u[14], 0.0, 0.92));
        float luma = dot(col, float3(0.3, 0.59, 0.11));
        col = mix(float3(luma), col, u[11] * 2.0);
        float contrast = mix(0.55, 1.7, u[12]);
        col = clamp((col - 0.5) * contrast + 0.5, 0.0, 1.0);
        if (u[10] > 0.5) col = float3(0.0);
        col *= u[2];
        float vignette = smoothstep(1.35, 0.2, length((uv - 0.5) * float2(max(0.5, u[7]), 1.0)));
        return col * vignette;
    }

    fragment float4 fs_canvas(VOut in [[stage_in]], constant float *u [[buffer(0)]],
                              texture2d<float> t0 [[texture(0)]], texture2d<float> t1 [[texture(1)]],
                              texture2d<float> t2 [[texture(2)]], texture2d<float> t3 [[texture(3)]],
                              texture2d<float> t4 [[texture(4)]], texture2d<float> t5 [[texture(5)]],
                              texture2d<float> t6 [[texture(6)]], texture2d<float> t7 [[texture(7)]],
                              texture2d<float> fb [[texture(8)]]) {
        constexpr sampler samp(filter::linear, address::clamp_to_edge);
        int pass = int(u[35] + 0.5);
        float3 col = pass == 0
            ? composite(in.uv, u, true, t0, t1, t2, t3, t4, t5, t6, t7, fb, samp)
            : stackCanvas(in.uv, u, t0, t1, t2, t3, t4, t5, t6, t7, fb, samp);
        return float4(col, 1.0);
    }

    fragment float4 fs_present(VOut in [[stage_in]], constant float *u [[buffer(0)]],
                               texture2d<float> t0 [[texture(0)]], texture2d<float> t1 [[texture(1)]],
                               texture2d<float> t2 [[texture(2)]], texture2d<float> t3 [[texture(3)]],
                               texture2d<float> t4 [[texture(4)]], texture2d<float> t5 [[texture(5)]],
                               texture2d<float> t6 [[texture(6)]], texture2d<float> t7 [[texture(7)]],
                               texture2d<float> fb [[texture(8)]],
                               texture2d<float> c0 [[texture(9)]], texture2d<float> c1 [[texture(10)]],
                               texture2d<float> c2 [[texture(11)]]) {
        constexpr sampler samp(filter::linear, address::clamp_to_edge);
        int split = int(u[13] * 2.0 + 0.5);
        float2 uv = in.uv;
        float3 col;
        if (split <= 0) {
            col = finishProgram(uv, u, c0, c1, c2, fb, samp);
        } else if (split == 1) {
            if (uv.x < 0.5) col = finishProgram(float2(uv.x * 2.0, uv.y), u, c0, c1, c2, fb, samp);
            else if (uv.y < 0.5) col = c1.sample(samp, float2((uv.x - 0.5) * 2.0, uv.y * 2.0)).rgb;
            else col = c2.sample(samp, float2((uv.x - 0.5) * 2.0, (uv.y - 0.5) * 2.0)).rgb;
        } else {
            float2 cell = floor(uv * 2.0);
            float2 local = fract(uv * 2.0);
            if (cell.x < 0.5 && cell.y < 0.5) col = finishProgram(local, u, c0, c1, c2, fb, samp);
            else if (cell.y < 0.5) col = c0.sample(samp, local).rgb;
            else if (cell.x < 0.5) col = c1.sample(samp, local).rgb;
            else col = c2.sample(samp, local).rgb;
        }
        return float4(col, 1.0);
    }

    fragment float4 fs_blit(VOut in [[stage_in]], texture2d<float> tex [[texture(0)]]) {
        constexpr sampler samp(filter::linear, address::clamp_to_edge);
        return tex.sample(samp, in.uv);
    }
    """
}

@MainActor
final class OutputBoard {
    static let shared = OutputBoard()
    private(set) var view: MTKView?
    private var window: NSWindow?
    var which = 1

    var isOpen: Bool { window?.isVisible == true }

    func open(device: MTLDevice) {
        if window == nil {
            let view = MTKView(frame: NSRect(x: 0, y: 0, width: 960, height: 540), device: device)
            view.colorPixelFormat = .bgra8Unorm
            view.framebufferOnly = false
            view.isPaused = true
            view.enableSetNeedsDisplay = false
            view.clearColor = MTLClearColor(red: 0, green: 0, blue: 0, alpha: 1)
            let window = NSWindow(
                contentRect: NSRect(x: 120, y: 80, width: 960, height: 540),
                styleMask: [.titled, .closable, .resizable, .miniaturizable],
                backing: .buffered,
                defer: false
            )
            window.title = "Canvas output"
            window.contentView = view
            window.isReleasedWhenClosed = false
            self.view = view
            self.window = window
        }
        window?.makeKeyAndOrderFront(nil)
    }

    func sendToNextDisplay() -> String {
        guard let window else { return "Open the output window first" }
        let screens = NSScreen.screens
        guard let screen = screens.dropFirst().first else {
            return "Only one display is connected. The output window stays here."
        }
        window.setFrame(screen.frame, display: true)
        window.makeKeyAndOrderFront(nil)
        return "Canvas output is on \(screen.localizedName)"
    }
}

struct MetalCanvas: NSViewRepresentable {
    var session: Session
    @Binding var error: String?

    func makeCoordinator() -> Coordinator { Coordinator(session: session) }

    func makeNSView(context: Context) -> MTKView {
        let view = MTKView()
        view.device = MTLCreateSystemDefaultDevice()
        view.colorPixelFormat = .bgra8Unorm
        view.framebufferOnly = false
        view.preferredFramesPerSecond = 60
        view.isPaused = false
        view.enableSetNeedsDisplay = false
        view.delegate = context.coordinator
        view.clearColor = MTLClearColor(red: 0, green: 0, blue: 0, alpha: 1)
        context.coordinator.attach(to: view) { message in
            DispatchQueue.main.async { self.error = message }
        }
        return view
    }

    func updateNSView(_ nsView: MTKView, context: Context) {
        context.coordinator.session = session
    }

    @MainActor
    final class Coordinator: NSObject, MTKViewDelegate {
        var session: Session
        var canvasPipeline: MTLRenderPipelineState?
        var presentPipeline: MTLRenderPipelineState?
        var blitPipeline: MTLRenderPipelineState?
        var queue: MTLCommandQueue?
        var reported = false
        var isfGeneration = -1
        var colorTarget: MTLTexture?
        var canvasTextures = [MTLTexture?](repeating: nil, count: 3)
        var black: MTLTexture?
        var feedback = [MTLTexture?](repeating: nil, count: 2)
        var feedbackIndex = 0
        let playback = PlaybackDeck()
        let recorder = PerformanceRecorder()

        init(session: Session) { self.session = session }

        @MainActor
        func attach(to view: MTKView, report: @escaping (String?) -> Void) {
            guard let device = view.device else {
                report("This Mac has no Metal device.")
                return
            }
            queue = device.makeCommandQueue()
            rebuild(device: device, report: report)
        }

        @MainActor
        func rebuild(device: MTLDevice, report: @escaping (String?) -> Void = { _ in }) {
            do {
                let library = try device.makeLibrary(source: CanvasShader.source(isf: session.isfMetal), options: nil)
                guard let vertex = library.makeFunction(name: "vs_main"),
                      let canvas = library.makeFunction(name: "fs_canvas"),
                      let present = library.makeFunction(name: "fs_present"),
                      let blit = library.makeFunction(name: "fs_blit") else {
                    report("Shader functions were not found.")
                    return
                }
                func make(_ fragment: MTLFunction) throws -> MTLRenderPipelineState {
                    let descriptor = MTLRenderPipelineDescriptor()
                    descriptor.vertexFunction = vertex
                    descriptor.fragmentFunction = fragment
                    descriptor.colorAttachments[0].pixelFormat = .bgra8Unorm
                    return try device.makeRenderPipelineState(descriptor: descriptor)
                }
                canvasPipeline = try make(canvas)
                presentPipeline = try make(present)
                blitPipeline = try make(blit)
                isfGeneration = session.isfGeneration
                report(nil)
            } catch {
                report(String(describing: error))
            }
        }

        func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {}

        func draw(in view: MTKView) {
            guard let device = view.device, let queue, let drawable = view.currentDrawable else { return }
            if session.isfGeneration != isfGeneration {
                rebuild(device: device) { message in
                    if let message { self.errorHook(message) }
                }
            }
            guard let canvasPipeline, let presentPipeline else { return }
            let width = max(2, Int(view.drawableSize.width))
            let height = max(2, Int(view.drawableSize.height))
            ensureTargets(device: device, width: width, height: height)
            guard let colorTarget, let readback = feedback[feedbackIndex], let buffer = queue.makeCommandBuffer() else { return }
            if black == nil { black = solid(device) }
            playback.sync(device: device, session: session)
            let aspect = Double(width) / Double(height)
            let pack = session.uniformPack(aspect: aspect, width: Double(width), height: Double(height))
            var shown = [MTLTexture?](repeating: black, count: 3)
            for index in 0..<3 {
                let size = pixelSize(index, viewWidth: width, viewHeight: height)
                guard let texture = ensureCanvas(device: device, index: index, width: size.0, height: size.1) else { continue }
                if !canvasActive(index) { continue }
                var uniforms = pack
                uniforms[7] = Float(size.0) / Float(max(1, size.1))
                uniforms[25] = Float(size.0)
                uniforms[26] = Float(size.1)
                uniforms[35] = Float(index)
                guard let encoder = buffer.makeRenderCommandEncoder(descriptor: pass(for: texture)) else { continue }
                encodeLayers(encoder, pipeline: canvasPipeline, uniforms: uniforms, feedback: readback)
                encoder.endEncoding()
                shown[index] = texture
            }
            var presentUniforms = pack
            presentUniforms[35] = 0
            if let encoder = buffer.makeRenderCommandEncoder(descriptor: pass(for: colorTarget)) {
                encoder.setRenderPipelineState(presentPipeline)
                presentUniforms.withUnsafeBytes { raw in
                    if let base = raw.baseAddress {
                        encoder.setFragmentBytes(base, length: raw.count, index: 0)
                    }
                }
                for index in 0..<8 {
                    encoder.setFragmentTexture(playback.texture(for: index), index: index)
                }
                encoder.setFragmentTexture(readback, index: 8)
                for index in 0..<3 {
                    encoder.setFragmentTexture(shown[index] ?? black, index: 9 + index)
                }
                encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3)
                encoder.endEncoding()
            }
            if OutputBoard.shared.isOpen, let blitPipeline, let output = OutputBoard.shared.view, let extra = output.currentDrawable,
               let source = shown[min(2, max(0, OutputBoard.shared.which))] ?? black,
               let encoder = buffer.makeRenderCommandEncoder(descriptor: pass(for: extra.texture)) {
                encoder.setRenderPipelineState(blitPipeline)
                encoder.setFragmentTexture(source, index: 0)
                encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3)
                encoder.endEncoding()
                buffer.present(extra)
            }
            if let blit = buffer.makeBlitCommandEncoder() {
                blit.copy(from: colorTarget, sourceSlice: 0, sourceLevel: 0, sourceOrigin: MTLOrigin(x: 0, y: 0, z: 0), sourceSize: MTLSize(width: width, height: height, depth: 1), to: drawable.texture, destinationSlice: 0, destinationLevel: 0, destinationOrigin: MTLOrigin(x: 0, y: 0, z: 0))
                let next = feedback[(feedbackIndex + 1) % 2]
                if let next {
                    blit.copy(from: colorTarget, sourceSlice: 0, sourceLevel: 0, sourceOrigin: MTLOrigin(x: 0, y: 0, z: 0), sourceSize: MTLSize(width: width, height: height, depth: 1), to: next, destinationSlice: 0, destinationLevel: 0, destinationOrigin: MTLOrigin(x: 0, y: 0, z: 0))
                }
                blit.endEncoding()
            }
            buffer.present(drawable)
            buffer.commit()
            feedbackIndex = (feedbackIndex + 1) % 2
            if session.recording {
                buffer.waitUntilCompleted()
                recorder.update(session: session, texture: colorTarget)
            }
        }

        private func pass(for texture: MTLTexture) -> MTLRenderPassDescriptor {
            let descriptor = MTLRenderPassDescriptor()
            descriptor.colorAttachments[0].texture = texture
            descriptor.colorAttachments[0].loadAction = .clear
            descriptor.colorAttachments[0].storeAction = .store
            descriptor.colorAttachments[0].clearColor = MTLClearColor(red: 0, green: 0, blue: 0, alpha: 1)
            return descriptor
        }

        private func encodeLayers(_ encoder: MTLRenderCommandEncoder, pipeline: MTLRenderPipelineState, uniforms: [Float], feedback: MTLTexture) {
            encoder.setRenderPipelineState(pipeline)
            uniforms.withUnsafeBytes { raw in
                if let base = raw.baseAddress {
                    encoder.setFragmentBytes(base, length: raw.count, index: 0)
                }
            }
            for index in 0..<8 {
                encoder.setFragmentTexture(playback.texture(for: index), index: index)
            }
            encoder.setFragmentTexture(feedback, index: 8)
            encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3)
        }

        private func canvasActive(_ index: Int) -> Bool {
            if index == 0 { return true }
            if OutputBoard.shared.isOpen && OutputBoard.shared.which == index { return true }
            let mix = index == 1 ? (session.values["canvasB.opacity"] ?? 0) : (session.values["canvasC.opacity"] ?? 0)
            if mix > 0.01 { return true }
            for prefix in LayerStack.prefixes {
                let target = LayerStack.choice(session.values["\(prefix).canvas"] ?? 0, count: LayerStack.canvases.count)
                if target == index && (session.values["\(prefix).opacity"] ?? 0) > 0.01 { return true }
            }
            return false
        }

        private func pixelSize(_ index: Int, viewWidth: Int, viewHeight: Int) -> (Int, Int) {
            let spec = index < session.canvasSizes.count ? session.canvasSizes[index] : CanvasSpec(width: 1280, height: 720)
            if index == 0 && (spec.width < 16 || spec.height < 16) { return (viewWidth, viewHeight) }
            let width = min(3840, max(160, spec.width == 0 ? 1280 : spec.width))
            let height = min(3840, max(160, spec.height == 0 ? 720 : spec.height))
            return (width, height)
        }

        private func ensureCanvas(device: MTLDevice, index: Int, width: Int, height: Int) -> MTLTexture? {
            if let existing = canvasTextures[index], existing.width == width, existing.height == height { return existing }
            let descriptor = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .bgra8Unorm, width: width, height: height, mipmapped: false)
            descriptor.usage = [.renderTarget, .shaderRead]
            descriptor.storageMode = .shared
            let texture = device.makeTexture(descriptor: descriptor)
            canvasTextures[index] = texture
            return texture
        }

        private func solid(_ device: MTLDevice) -> MTLTexture? {
            let descriptor = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .bgra8Unorm, width: 1, height: 1, mipmapped: false)
            descriptor.usage = [.shaderRead]
            descriptor.storageMode = .shared
            guard let texture = device.makeTexture(descriptor: descriptor) else { return nil }
            var pixel: [UInt8] = [0, 0, 0, 255]
            texture.replace(region: MTLRegionMake2D(0, 0, 1, 1), mipmapLevel: 0, withBytes: &pixel, bytesPerRow: 4)
            return texture
        }

        private func errorHook(_ message: String) {
            session.status = message
        }

        private func ensureTargets(device: MTLDevice, width: Int, height: Int) {
            if let colorTarget, colorTarget.width == width, colorTarget.height == height { return }
            let descriptor = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .bgra8Unorm, width: width, height: height, mipmapped: false)
            descriptor.usage = [.renderTarget, .shaderRead]
            descriptor.storageMode = .shared
            colorTarget = device.makeTexture(descriptor: descriptor)
            feedback[0] = device.makeTexture(descriptor: descriptor)
            feedback[1] = device.makeTexture(descriptor: descriptor)
        }
    }
}
