"""Comprobaciones numéricas del DeconvNet: unpool exacto y adjunto de la convolución."""

from __future__ import annotations

import torch
import torch.nn.functional as F

torch.manual_seed(0)


def check_unpool():
    x = torch.randn(2, 8, 109, 109)
    out, idx = F.max_pool2d(x, kernel_size=3, stride=2, return_indices=True)
    back = F.max_unpool2d(out, idx, kernel_size=3, stride=2)
    # el valor devuelto al mapa grande debe coincidir, posición por posición, con el máximo original
    recovered = back.flatten(2).gather(2, idx.flatten(2))
    print(f"unpool: forma {tuple(back.shape)} (esperado (2,8,109,109))")
    print(f"  valores recolocados correctamente: {torch.allclose(recovered, out.flatten(2))}")
    # cuántos valores de entrada se recuperan exactamente
    print(f"  fracción de posiciones no nulas: {(back != 0).float().mean():.3f}")


def check_adjoint():
    for k, s, p, op in ((7, 2, 0, 1), (5, 2, 0, 1), (3, 1, 1, 0)):
        x = torch.randn(1, 4, 20, 20)
        w = torch.randn(6, 4, k, k)
        y = F.conv2d(x, w, stride=s, padding=p)
        z = torch.randn_like(y)
        lhs = (y * z).sum()
        rhs = (x * F.conv_transpose2d(z, w, stride=s, padding=p, output_padding=op)).sum()
        print(f"adjunto k={k} s={s} p={p}: |<Cx,z> - <x,C^T z>| = {abs(lhs - rhs):.3e}")


if __name__ == "__main__":
    check_unpool()
    check_adjoint()
