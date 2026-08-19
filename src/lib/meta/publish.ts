import { graphGet, graphPost } from "@/lib/meta/graph";

function isVideoFormat(format: string): boolean {
  return format === "REELS" || format === "VIDEO";
}

async function waitForContainerReady(creationId: string, pageAccessToken: string, maxWaitMs = 60000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const data = await graphGet<{ status_code?: string }>(`/${creationId}`, {
      fields: "status_code",
      access_token: pageAccessToken,
    });
    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR") throw new Error("O processamento do vídeo falhou na Meta.");
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error("O vídeo demorou demais para processar. Tente novamente em alguns minutos.");
}

export async function publishToInstagram(params: {
  igUserId: string;
  pageAccessToken: string;
  format: "IMAGE" | "CAROUSEL" | "REELS" | "VIDEO" | "STORIES";
  caption: string;
  mediaUrls: string[];
}): Promise<{ permalink: string | null; mediaId: string }> {
  const { igUserId, pageAccessToken, format, caption, mediaUrls } = params;

  if (format === "VIDEO") {
    throw new Error('Formato "Vídeo" não é publicável no Instagram — use Reels.');
  }

  let creationId: string;

  if (format === "STORIES") {
    const isVideo = /\.(mp4|mov)$/i.test(mediaUrls[0].split("?")[0]);
    const container = await graphPost<{ id: string }>(`/${igUserId}/media`, {
      media_type: "STORIES",
      [isVideo ? "video_url" : "image_url"]: mediaUrls[0],
      access_token: pageAccessToken,
    });
    creationId = container.id;
    if (isVideo) await waitForContainerReady(creationId, pageAccessToken);
  } else if (format === "CAROUSEL") {
    const childIds = await Promise.all(
      mediaUrls.map(async (url) => {
        const isVideo = /\.(mp4|mov)$/i.test(url.split("?")[0]);
        const child = await graphPost<{ id: string }>(`/${igUserId}/media`, {
          [isVideo ? "video_url" : "image_url"]: url,
          is_carousel_item: "true",
          access_token: pageAccessToken,
        });
        return child.id;
      })
    );

    const container = await graphPost<{ id: string }>(`/${igUserId}/media`, {
      media_type: "CAROUSEL",
      children: childIds.join(","),
      caption,
      access_token: pageAccessToken,
    });
    creationId = container.id;
  } else if (format === "REELS") {
    const container = await graphPost<{ id: string }>(`/${igUserId}/media`, {
      media_type: "REELS",
      video_url: mediaUrls[0],
      caption,
      access_token: pageAccessToken,
    });
    creationId = container.id;
    await waitForContainerReady(creationId, pageAccessToken);
  } else {
    const container = await graphPost<{ id: string }>(`/${igUserId}/media`, {
      image_url: mediaUrls[0],
      caption,
      access_token: pageAccessToken,
    });
    creationId = container.id;
  }

  const published = await graphPost<{ id: string }>(`/${igUserId}/media_publish`, {
    creation_id: creationId,
    access_token: pageAccessToken,
  });

  const details = await graphGet<{ permalink?: string }>(`/${published.id}`, {
    fields: "permalink",
    access_token: pageAccessToken,
  }).catch(() => ({ permalink: undefined }));

  return { permalink: details.permalink ?? null, mediaId: published.id };
}

export async function publishToFacebook(params: {
  pageId: string;
  pageAccessToken: string;
  format: "IMAGE" | "CAROUSEL" | "REELS" | "VIDEO" | "STORIES";
  caption: string;
  mediaUrls: string[];
}): Promise<{ permalink: string | null; mediaId: string }> {
  const { pageId, pageAccessToken, format, caption, mediaUrls } = params;

  if (format === "STORIES") {
    throw new Error('Formato "Stories" não é suportado para publicação no Facebook por esta ferramenta.');
  }

  if (isVideoFormat(format)) {
    const result = await graphPost<{ id: string }>(`/${pageId}/videos`, {
      file_url: mediaUrls[0],
      description: caption,
      access_token: pageAccessToken,
    });
    return { permalink: `https://www.facebook.com/${result.id}`, mediaId: result.id };
  }

  // CAROUSEL no Facebook via API simples vira um álbum de fotos individuais;
  // publicamos a primeira como post principal com a legenda.
  const result = await graphPost<{ id: string; post_id?: string }>(`/${pageId}/photos`, {
    url: mediaUrls[0],
    caption,
    access_token: pageAccessToken,
  });

  return { permalink: `https://www.facebook.com/${result.post_id ?? result.id}`, mediaId: result.post_id ?? result.id };
}

const ERROR_TRANSLATIONS: { match: RegExp; message: string }[] = [
  { match: /access token|session has expired|token/i, message: "É necessário reconectar a conta — o acesso expirou ou foi revogado." },
  { match: /permission/i, message: "A conta perdeu uma permissão necessária para publicar. Reconecte-a." },
  { match: /media type|format|video/i, message: "O arquivo enviado não atende aos requisitos da Meta para este formato." },
  { match: /rate limit|too many/i, message: "Limite de publicações atingido. Tente novamente mais tarde." },
];

export function translateMetaError(rawMessage: string): string {
  const match = ERROR_TRANSLATIONS.find((t) => t.match.test(rawMessage));
  return match?.message ?? "Não foi possível publicar. Tente novamente em alguns minutos.";
}
