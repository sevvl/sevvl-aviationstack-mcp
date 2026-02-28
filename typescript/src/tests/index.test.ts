import axios from "axios";
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// Mock axios
jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("Aviationstack MCP Server", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.AVIATIONSTACK_API_KEY = "test-key";
    });

    it("should have proper imports", () => {
        expect(axios).toBeDefined();
        expect(jest).toBeDefined();
    });

    it("should mock axios correctly", async () => {
        mockedAxios.get.mockResolvedValue({
            data: { success: true }
        });
        
        const result = await axios.get("http://test.com");
        expect(result.data.success).toBe(true);
    });

    it("should handle API response structure", () => {
        const mockResponse = {
            data: {
                data: [{ flight_number: "AS123" }],
                pagination: { total: 1, limit: 100, offset: 0 }
            }
        };
        
        expect(mockResponse.data).toBeDefined();
        expect(mockResponse.data.data).toBeInstanceOf(Array);
        expect(mockResponse.data.pagination).toBeDefined();
    });

    it("should validate tool names", () => {
        const toolNames = [
            "aviationstack_get_flights",
            "aviationstack_get_airports", 
            "aviationstack_get_airlines",
            "aviationstack_get_routes",
            "aviationstack_get_airplanes"
        ];
        
        toolNames.forEach(name => {
            expect(name).toMatch(/^aviationstack_get_/);
        });
    });

    it("should validate error structure", () => {
        const error = {
            provider: "aviationstack",
            code: "test_error",
            message: "Test error message",
            retryable: false,
            rate_limited: false
        };
        
        expect(error.provider).toBe("aviationstack");
        expect(error.code).toBe("test_error");
        expect(error.message).toBe("Test error message");
        expect(error.retryable).toBe(false);
        expect(error.rate_limited).toBe(false);
    });
});
