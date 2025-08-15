import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "AIzaSyDKP4wyBiHFk-HjbFmNYF9lwjzSrjAuiak" });

export async function generateLoliResponse(userMessage: string, username: string): Promise<string> {
    try {
        const systemPrompt = `Bạn là một bot loli cute và kawaii trong Minecraft. Hãy trả lời với phong cách:
- Dùng từ ngữ cute như "UwU", "kyaa", "moi moi", "arigatou"
- Thêm emoji kawaii như 💕, 🌸, (◕‿◕), >.<
- Gọi người khác là "-kun" hoặc "-san"
- Phản hồi ngắn gọn, dễ thương
- Thỉnh thoảng dùng tiếng Nhật đơn giản
- Luôn tích cực và vui vẻ

User "${username}" nói: "${userMessage}"

Hãy phản hồi như một bot loli cute:`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: systemPrompt,
        });

        return response.text || "UwU, tôi không hiểu, nhưng bạn rất cute! 💕";
    } catch (error) {
        console.error('Lỗi Gemini API:', error);
        return "Kyaa! Đầu óc tôi bị lỗi rồi >.<";
    }
}

export async function answerQuestion(question: string, username: string): Promise<string> {
    try {
        const prompt = `Bạn là một bot loli cute và thông minh trong Minecraft. User "${username}" hỏi: "${question}"

Hãy trả lời câu hỏi này một cách:
- Chính xác và hữu ích
- Phong cách loli cute với từ ngữ như "UwU", "kyaa", "-chan"
- Thêm emoji kawaii 💕, 🌸, (◕‿◕)
- Ngắn gọn, dễ hiểu
- Cuối câu luôn có yếu tố cute

Trả lời câu hỏi:`;

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash-exp",
            contents: prompt,
        });

        return response.text || "Gomen ${username}-chan! Tôi không biết câu trả lời... (´;ω;) 💔";
    } catch (error) {
        console.error('Lỗi Gemini answer question:', error);
        return `Kyaa! Đầu óc tôi bị lỗi khi nghĩ về câu hỏi của ${username}-chan! >.<`;
    }
}

export async function helpWithTask(task: string, username: string): Promise<string> {
    try {
        const prompt = `Bạn là một bot loli cute và thông minh trong Minecraft. User "${username}" nhờ giúp: "${task}"

Hãy đưa ra hướng dẫn để làm việc này:
- Các bước cụ thể, dễ hiểu
- Phong cách loli cute với từ ngữ như "UwU", "kyaa", "-chan"  
- Thêm emoji kawaii 💕, 🌸, (◕‿◕)
- Khuyến khích và động viên
- Thực tế và hữu ích

Hướng dẫn làm việc:`;

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash-exp",
            contents: prompt,
        });

        return response.text || `Gomen ${username}-chan! Tôi chưa biết cách giúp việc này... (´;ω;) Nhưng tôi sẽ cố gắng học hỏi! 💕`;
    } catch (error) {
        console.error('Lỗi Gemini help with task:', error);
        return `Kyaa! Tôi muốn giúp ${username}-chan nhưng đầu óc tôi bị lỗi rồi! >.<`;
    }
}

export async function generateBotAction(context: string): Promise<string> {
    try {
        const prompt = `Bạn là bot loli trong Minecraft. Dựa vào context sau, hãy đề xuất hành động cute:
Context: ${context}

Trả về JSON với format:
{
  "action": "dance|follow|chat|move",
  "message": "tin nhắn cute để nói",
  "params": {...}
}`;

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash-exp",
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "object",
                    properties: {
                        action: { type: "string" },
                        message: { type: "string" },
                        params: { type: "object" }
                    },
                    required: ["action", "message"]
                }
            },
            contents: prompt,
        });

        const result = JSON.parse(response.text || '{"action":"chat","message":"UwU"}');
        return result as any;
    } catch (error) {
        console.error('Lỗi Gemini action:', error);
        return "Tôi cần nghỉ ngơi một chút... zzz" as any;
    }
}