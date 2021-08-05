#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""Generate config with English instruction."""

import argparse
from distutils.util import strtobool
import fnmatch
import os
from pathlib import Path
import random
import re

import yaml


def str2bool(value: str) -> bool:
    return bool(strtobool(value))


def str2triple_str(string):
    return string.split(",")


METRICS = {
    "MOS": {
        # active background color for each metric tab (and the corresponding sliders)
        "color": "#ED8C01",
        # tab content for each metric tab
        "content":
            "Listen to a reference audio and several processed audios. "
            "Then evaluate whether the quality of speech is well preserved, "
            "and whether the noise is well suppressed."
            "<br>"
            "Note: The reference audio might also contain some noise. It is "
            "preferred if the noise is suppressed in the processed audios.",
    }, 
    "S-MOS": {
        "color": "#007ACC",
        "content":
            "Listen to a reference audio and several processed audios. "
            "Then evaluate whether the quality of speech is well preserved, "
            "and whether the noise is well suppressed."
            "<br>"
            "Note: The reference audio might also contain some noise. It is "
            "preferred if the noise is suppressed in the processed audios.",
    },
    "N-MOS": {
        "color": "#2f9b5c",
        "content":
            "Listen to a reference audio and several processed audios. "
            "Then evaluate whether the quality of speech is well preserved, "
            "and whether the noise is well suppressed."
            "<br>"
            "Note: The reference audio might also contain some noise. It is "
            "preferred if the noise is suppressed in the processed audios.",
    },
}


def response_template():
    return [
        {
            "value": 1,
            "label": "1: Bad",
            "img": "configs/resources/images/star_off.png",
            "imgSelected": "configs/resources/images/star_on.png",
            "imgHigherResponseSelected": "configs/resources/images/star_on.png",
        },
        {
            "value": 2,
            "label": "2: Poor",
            "img": "configs/resources/images/star_off.png",
            "imgSelected": "configs/resources/images/star_on.png",
            "imgHigherResponseSelected": "configs/resources/images/star_on.png",
        },
        {
            "value": 3,
            "label": "3: Fair",
            "img": "configs/resources/images/star_off.png",
            "imgSelected": "configs/resources/images/star_on.png",
            "imgHigherResponseSelected": "configs/resources/images/star_on.png",
        },
        {
            "value": 4,
            "label": "4: Good",
            "img": "configs/resources/images/star_off.png",
            "imgSelected": "configs/resources/images/star_on.png",
            "imgHigherResponseSelected": "configs/resources/images/star_on.png",
        },
        {
            "value": 5,
            "label": "5: Excellent",
            "img": "configs/resources/images/star_off.png",
            "imgSelected": "configs/resources/images/star_on.png",
            "imgHigherResponseSelected": "configs/resources/images/star_on.png",
        },
    ]


def make_page(idx, total_idx, wav_path):
    wav_dir_id = os.path.basename(os.path.dirname(wav_path))
    wav_file_id = os.path.basename(wav_path)
    wav_id = f"{wav_dir_id}_{wav_file_id}"
    return {
        "type": "likert_single_stimulus",
        "id": wav_id,
        "content": "Listen to a given sample and rate the naturalness with 5-point scale."
                   "<br>"
                   "Note that the naturalness means how the sample sound like real-human speech "
                   "and real-human speech is corresponding to 5.",
        "name": f"MOS on Naturalness ({idx}/{total_idx})",
        "mustRate": True,
        "mustPlayback": True,
        "reference": wav_path,
        "stimuli": {
            "C1": wav_path,
        },
        "response": response_template(),
    }


def make_first_page():
    return {
        "type": "generic",
        "content": "Welcome to audio naturalness evaluation."
                   "<br>"
                   "Please click [Next] button.",
        "id": "welcome",
        "name": "Audio naturalness evaluation",
    }


def make_explanation_page():
    return {
        "type": "generic",
        "content": "Listen to a given sample and rate the naturalness with 5-point scale."
                   "<br>"
                   "Note that the naturalness means how the sample sound like real-human speech "
                   "and real-human speech is corresponding to 5."
                   "<br>"
                   "After that, we provide the sample of real-human speech as a reference."
                   "<br>"
                   "<br>"
                   "<strong>DO NOT CLOSE AND RELOAD THIS PAGE UNTIL THE END OF THIS EVALUATION.</strong>"
                   "<br>"
                   "<br>"
                   "Please click [Next] button.",
        "id": "explanation",
        "name": "Explanation",
    }


def make_volume_page(sample_wav_path):
    volume_page = {
        "type": "volume",
        "content": "This is a sample of real-human speech.<br>"
                   "Listen to the sample and adjust your volume.<br>"
                   "<br>"
                   "<strong>DURING THE EVALUATION, PLEASE USE HEADPHONES AND WORK IN A QUIET ROOM.</strong>",
        "id": "Volume check",
        "stimulus": sample_wav_path,
        "defaultVolume": 1.0,
    }
    return volume_page


def make_finish_page():
    return {
        "type": "finish",
        "content": "The evaluation was finished.<br>"
                   "Please enter your <strong>ID</strong>. <br>"
                   "Please click [send Results] button.",
        "id": "finish",
        "name": "Finshed evaluation",
        "popupContent": "The results were recorded. Thank you for your cooperation.",
        "showResults": True,
        "writeResults": True,
        "questionnaire": [
            {
                "type": "text",
                "label": "Name",
                "name": "name",
                "optional": False,
            },
        ]
    }


def similarity_response_template():
    return [
        {
            "value": 1,
            "label": "1: Different (sure)",
            "img": "configs/resources/images/star_off.png",
            "imgSelected": "configs/resources/images/star_on.png",
            "imgHigherResponseSelected": "configs/resources/images/star_on.png",
        },
        {
            "value": 2,
            "label": "2: Different (not sure)",
            "img": "configs/resources/images/star_off.png",
            "imgSelected": "configs/resources/images/star_on.png",
            "imgHigherResponseSelected": "configs/resources/images/star_on.png",
        },
        {
            "value": 3,
            "label": "3: Same (not sure)",
            "img": "configs/resources/images/star_off.png",
            "imgSelected": "configs/resources/images/star_on.png",
            "imgHigherResponseSelected": "configs/resources/images/star_on.png",
        },
        {
            "value": 4,
            "label": "4: Same (sure)",
            "img": "configs/resources/images/star_off.png",
            "imgSelected": "configs/resources/images/star_on.png",
            "imgHigherResponseSelected": "configs/resources/images/star_on.png",
        },
    ]


def make_enh_page(idx, total_idx, ref_wav_path, test_wav_dict, metrics):
    ref_path = Path(ref_wav_path)
    wav_dir_id = ref_path.parent.name
    wav_file_id = ref_path.stem
    wav_id = f"{wav_dir_id}_{wav_file_id}"
    return {
        # "type": "likert_multi_stimulus",
        "type": "multi_metric_mushra",
        "id": wav_id,
        "metrics": metrics,
        "colors": [METRICS[metric]["color"] for metric in metrics],
        "content": [METRICS[metric]["content"] for metric in metrics],
        "name": f"Speech Enhancement Quality ({idx}/{total_idx})",
        "mustPlayAll": True,
        "mustViewAllTabs": True,
        "createAnchor35": False,
        "createAnchor70": False,
        "enableLooping": True,
        "showConditionNames": False,
        "randomize": True,
        "reference": ref_wav_path,
        "stimuli": test_wav_dict,
        "response": response_template(),
    }


def make_enh_first_page():
    return {
        "type": "generic",
        "content": "Next, speaker similarity evaluation."
                   "<br>"
                   "Please click [Next] button.",
        "id": "welcome",
        "name": "Speaker similarity evaluation",
    }


def make_enh_explanation_page():
    return {
        "type": "generic",
        "content": "Listen to continuous two samples and evaluate whether the "
                   "speakers of two samples are same or not."
                   "<br>"
                   "<br>"
                   "<strong>DO NOT CLOSE AND RELOAD THIS PAGE UNTIL THE END OF THIS EVALUATION.</strong>"
                   "<br>"
                   "<br>"
                   "Please click [Next] button.",
        "id": "explanation",
        "name": "Explanation",
    }


def find_files(root_dir, query="*.wav", include_root_dir=True):
    """Find files recursively.

    Args:
        root_dir (str): Root root_dir to find.
        query (str): Query to find.
        include_root_dir (bool): If False, root_dir name is not included.

    Returns:
        list: List of found filenames.

    """
    files = []
    for root, dirnames, filenames in os.walk(root_dir, followlinks=True):
        for filename in fnmatch.filter(filenames, query):
            files.append(os.path.join(root, filename))
    if not include_root_dir:
        files = [file_.replace(root_dir + "/", "") for file_ in files]

    return files


# def main():
parser = argparse.ArgumentParser()
parser.add_argument("--sample_audio_path", default=None, type=str, nargs="+")
parser.add_argument("--metrics", default="MOS", type=str2triple_str)
parser.add_argument("--seed", default=777, type=int)
parser.add_argument("--random", default=True, type=str2bool, help="Generate evaluation pages with random orders.")
parser.add_argument("--ref_root_wav_dir", default=None, type=str)
parser.add_argument("--test_root_wav_dir", required=True, type=str, nargs="+")
parser.add_argument("--outpath", required=True, type=str)
args = parser.parse_args()

for metric in args.metrics:
    print(metric)
    if metric not in METRICS:
        raise ValueError("Unkown metric: %s" % metric)

config = {
    "testname": "Subjective evaluation",
    "testId": "subjective_evalaution",
    "bufferSize": 2048,
    "stopOnErrors": True,
    "showButtonPreviousPage": True,
    "showWaveform": True,
    "language": "en",
    "remoteService": "service/write.php",
    "pages": [],
}

test_sets = {}
for subset in args.test_root_wav_dir:
    test_sets[Path(subset).name] = {Path(p).stem: p for p in sorted(find_files(subset))}
keys = next(iter(test_sets.values())).keys()
for name, dic in test_sets.items():
    assert dic.keys() == keys, name

wav_path_list = sorted(find_files(args.ref_root_wav_dir))
random.seed(args.seed)
random.shuffle(wav_path_list)
ref_wavs = {Path(p).stem: p for p in wav_path_list}
uttids = ref_wavs.keys()
assert sorted(uttids) == sorted(keys)
config["pages"] += [make_first_page()]
config["pages"] += [make_explanation_page()]

if args.sample_audio_path is not None:
    for sample_wav in args.sample_audio_path:
        config["pages"] += [make_volume_page(sample_wav)]

if args.random:
    evaluation_pages = ["random"]
else:
    evaluation_pages = []
for idx, uid in enumerate(uttids, 1):
    print('uid: ', uid)
    evaluation_pages.append(
        make_enh_page(
            idx,
            len(uttids),
            ref_wavs[uid],
            {name: dic[uid] for name, dic in test_sets.items()},
            list(args.metrics),
        )
    )
config["pages"].append(evaluation_pages)

config["pages"] += [make_finish_page()]

with open(args.outpath, "w") as f:
    s = yaml.safe_dump(config, stream=None, allow_unicode=True, encoding="utf-8", line_break=True).decode()
    if args.random and "- - random" in s:
        s = re.sub(r"(?<=\n)(\s*)- (- random)\n(\s*)(?=-)", r"\1-\n\3\2\n\3", s)
    f.write(s)


# if __name__ == "__main__":
#     main()
