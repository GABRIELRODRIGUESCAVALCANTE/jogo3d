/**
 * Verificação de suporte gráfico.
 * O Three.js atual exige WebGL 2. Se o navegador não suportar, mostramos
 * uma mensagem compreensível em vez de uma tela preta.
 */
export interface WebGLSupport {
  ok: boolean;
  reason?: string;
}

export function checkWebGLSupport(): WebGLSupport {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) {
      return {
        ok: false,
        reason:
          'Seu navegador ou placa de vídeo não oferece suporte a WebGL 2, necessário para exibir o mundo 3D.',
      };
    }
    // Libera o contexto de teste imediatamente.
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { ok: true };
  } catch {
    return { ok: false, reason: 'Não foi possível inicializar os gráficos 3D neste navegador.' };
  }
}
