from pathlib import Path

# import matplotlib
# matplotlib.use('agg')

import matplotlib.pyplot as plt
import librosa
import soundfile as sf
from espnet.asr.asr_utils import plot_spectrogram
from espnet2.utils.types import str2bool


def prepare_spectrogram(
    audio,
    fs,
    output_path,
    mode="db",
    figsize=(5, 4),
    n_fft=0.032,
    hop_size=0.016,
    cmap="inferno",
    colorbar=False,
):
    n_fft = int(n_fft * fs)
    hop_size = int(hop_size * fs)
    spec = librosa.stft(audio, n_fft=n_fft, hop_length=hop_size)
    fig = plt.figure(figsize=figsize)
    if not colorbar and hasattr(plt, "colorbar"):
        delattr(plt, "colorbar")
    plot_spectrogram(
        plt,
        spec,
        mode=mode,
        fs=fs,
        frame_shift=hop_size,
        # left=False,
        # bottom=False,
        right=False,
        top=False,
        # labelbottom=False,
        # labelleft=False,
        labelright=False,
        cmap=cmap,
    )
    plt.tight_layout()
    plt.savefig(output_path)
    plt.clf()
    plt.close(fig)


def main():
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("root_audio_path", type=str)
    parser.add_argument("--audio_format", type=str, default=".wav")
    parser.add_argument("--ref_channel", type=int, default=0)
    parser.add_argument("--mode", type=str, default="db", choices=["db", "linear"])
    parser.add_argument(
        "--n_fft", type=float, default=0.032, help="FFT window size (ms)"
    )
    parser.add_argument(
        "--hop_size", type=float, default=0.016, help="FFT hop size (ms)"
    )
    parser.add_argument(
        "--figsize", type=str, default="5,4", help="fig size (width,height)"
    )
    parser.add_argument("--cmap", type=str, default="inferno", help="colormap")
    parser.add_argument("--colorbar", type=str2bool, default=False)
    args = parser.parse_args()

    root = Path(args.root_audio_path)
    for path in root.rglob("*" + args.audio_format):
        audio, fs = sf.read(path, always_2d=True)
        prepare_spectrogram(
            audio[:, args.ref_channel],
            fs,
            path.with_suffix(".png"),
            mode=args.mode,
            n_fft=args.n_fft,
            hop_size=args.hop_size,
            figsize=tuple(map(float, args.figsize.split(","))),
            cmap=args.cmap,
            colorbar=args.colorbar,
        )


if __name__ == "__main__":
    main()
