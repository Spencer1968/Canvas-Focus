// Replace this with your local machine's IP address or backend tunnel URL
// e.g., 'http://10.106.10.16:8000' or 'https://your-ngrok-or-tunnel-url.ngrok-free.app'
const API_BASE_URL = 'https://zq7xqxmg-8000.usw2.devtunnels.ms'; 

export const fetchAssignments = async (signal) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/assignments`, { 
        signal,
        headers: {
            'X-Tunnel-Skip-Anti-Phishing-Page': 'true',
            'Content-Type': 'application/json'}
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    return result.data;
  } catch (error) {
    if (error.name === 'AbortError') {
        throw new Error('Connection timed out. Campus Wi-Fi is blocking local IP access.');
    }
    console.error('Error fetching assignments:', error);
    throw error;
  }
};