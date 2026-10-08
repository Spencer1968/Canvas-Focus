// Replace this with your local machine's IP address or backend tunnel URL
// e.g., 'http://10.106.10.16:8000' or 'https://your-ngrok-or-tunnel-url.ngrok-free.app'
const API_BASE_URL = 'https://canvas-focus-api.onrender.com'; 

export const fetchAssignments = async (signal, userIcsUrl) => {
  let url = `${API_BASE_URL}/api/assignments`;
  if (userIcsUrl) {
    url += `?ics_url=${encodeURIComponent(userIcsUrl)}`;
  }
  try {
    const response = await fetch(url, { 
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
        throw new Error('Connection timed out. Please check your internet connection and try again.');
    }
    console.error('Error fetching assignments:', error);
    throw error;
  }
};