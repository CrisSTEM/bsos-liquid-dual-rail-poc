export async function apiFetch(url, options = {}) {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const error = new Error(
      typeof body === "object" && body !== null
        ? body.message || body.error || `HTTP ${response.status}`
        : body || `HTTP ${response.status}`,
    );

    error.payload =
      typeof body === "object" && body !== null
        ? body
        : {
            error: "http_error",
            message: String(body || `HTTP ${response.status}`),
          };

    error.status = response.status;
    throw error;
  }

  return body;
}
