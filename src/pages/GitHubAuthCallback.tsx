import { useEffect } from "react";

const GitHubAuthCallback = () => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payload = {
      type: "github-oauth",
      code: params.get("code") ?? undefined,
      state: params.get("state") ?? undefined,
      error: params.get("error_description") ?? params.get("error") ?? undefined,
    };

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, window.location.origin);
      window.close();
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
      <div className="text-center space-y-2">
        <p className="text-sm font-medium">Connecting GitHub...</p>
        <p className="text-xs text-muted-foreground">
          If this window does not close automatically, you can close it and return to the app.
        </p>
      </div>
    </div>
  );
};

export default GitHubAuthCallback;
