const IIJ_VIDEO_HOST = "dash.id111.oke.iijcdn.jp";
const IIJ_VIDEO_ORIGIN = `http://${IIJ_VIDEO_HOST}`;
const PROXY_PREFIX = "/api/video-cdn";

export function isIijVideoUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    return url.hostname === IIJ_VIDEO_HOST;
  } catch {
    return false;
  }
}

export function toProxiedVideoUrl(rawUrl: string, returnTo?: string) {
  try {
    const url = new URL(rawUrl);
    if (url.hostname !== IIJ_VIDEO_HOST) return rawUrl;
    const proxiedUrl = new URL(`${PROXY_PREFIX}${url.pathname}`, "http://localhost");
    proxiedUrl.search = url.search;
    if (returnTo) proxiedUrl.searchParams.set("returnTo", returnTo);
    return `${proxiedUrl.pathname}${proxiedUrl.search}`;
  } catch {
    return rawUrl;
  }
}

export function rewriteIijPlayerHtml(html: string, returnTo = "/videos") {
  const safeReturnTo = returnTo.startsWith("/videos") ? returnTo : "/videos";
  const serializedReturnTo = JSON.stringify(safeReturnTo);

  return html
    .replace(
      "var media_server = 'http://dash.id111.oke.iijcdn.jp';",
      `var media_server = window.location.origin + '${PROXY_PREFIX}';`,
    )
    .replace(
      "function closeVideoPlayer(){\n\tlog('closeVideoPlayer');\n}",
      [
        "function closeVideoPlayer(){",
        "\tlog('closeVideoPlayer');",
        "\tif (window.parent && window.parent !== window) {",
        "\t\ttry {",
        `\t\t\twindow.top.location.assign(${serializedReturnTo});`,
        "\t\t\treturn;",
        "\t\t} catch (e) {",
        `\t\t\twindow.parent.postMessage({ type: 'video-player-close', returnTo: ${serializedReturnTo} }, window.location.origin);`,
        "\t\t\treturn;",
        "\t\t}",
        "\t}",
        "\twindow.history.back();",
        "}",
      ].join("\n"),
    )
    .replace(
      'href="javascript:closeVideoPlayer();" class="ui-btn ui-shadow ui-corner-all ui-icon-delete ui-btn-icon-left"',
      `href="${safeReturnTo}" target="_top" onclick="try{window.top.location.assign(${serializedReturnTo});}catch(e){closeVideoPlayer();} return false;" class="ui-btn ui-shadow ui-corner-all ui-icon-delete ui-btn-icon-left"`,
    );
}

export { IIJ_VIDEO_HOST, IIJ_VIDEO_ORIGIN, PROXY_PREFIX };
