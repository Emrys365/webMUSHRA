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
        "content": {
            "en": "Listen to a reference audio and several processed audios."
                  "<br>"
                  "Then evaluate the <font color=\"red\">overall quality</font> of the "
                  "processed audio, i.e. "
                  "whether the speech signal is well preserved (undistorted), "
                  "while the background noise is well suppressed."
                  "<br>"
                  "Highly distorted speech with very intrusive noise is corresponding to 0. "
                  "Undistorted speech without noticeable noise is corresponding to 100."
                  "<br><br>"
                  "<strong>Note:</strong> The reference audio might also contain some noise. "
                  "And it is preferred if the noise is further suppressed in the processed audios.",
            "cn": "分别播放 reference 和处理后的音频，然后对处理后的音频的"
                  "<font color=\"red\">整体质量</font>进行评估，即"
                  "其中的语音信号是否很好地保留（无失真），同时背景噪声也被很好地抑制。"
                  "<br>"
                  "伴随着强干扰性噪声，且高度失真的语音，相应的得分是 0。"
                  "几乎没有噪声，且无失真的语音，相应的得分是 100。"
                  "<br><br>"
                  "<strong>注意：</strong>reference 音频可能也包含一定噪声，处理后的音频中如果噪声更小则更好。",
        },
    }, 
    "S-MOS": {
        "color": "#007ACC",
        "content": {
            "en": "Listen to a reference audio and several processed audios. "
                  "<br>"
                  "Then <strong>ONLY</strong> evaluate <font color=\"red\">speech quality</font> "
                  "in the processed audio, i.e. "
                  "whether the speech signal is well preserved (undistorted)."
                  "<br>"
                  "Highly distorted speech is corresponding to 0. "
                  "Undistorted speech is corresponding to 100."
                  "<br><br>"
                  "<strong>Note:</strong> Please <u>do not take account of the background noise</u> "
                  "when evaluating S-MOS.",
            "cn": "分别播放 reference 和处理后的音频，然后<strong>仅</strong>对"
                  "处理后的音频中的<font color=\"red\">语音质量</font>进行评估，即"
                  "其中的语音信号是否很好地保留（无失真）。"
                  "<br>"
                  "高度失真的语音，相应的得分是 0。"
                  "没有任何失真的语音，相应的得分是 100。"
                  "<br><br>"
                  "<strong>注意：</strong>在评估 S-MOS 分数时，请<u>不要将背景噪声考虑在内</u>。",
        },
    },
    "N-MOS": {
        "color": "#2f9b5c",
        "content": {
            "en": "Listen to a reference audio and several processed audios. "
                  "<br>"
                  "Then <strong>ONLY</strong> evaluate <font color=\"red\">noise level</font> "
                  "in the processed audio, i.e. "
                  "whether the background noise is well suppressed."
                  "<br>"
                  "Very intrusive noise is corresponding to 0. "
                  "Unnoticable noise is corresponding to 100."
                  "<br><br>"
                  "<strong>Note:</strong> Please <u>do not take account of the speech quality</u> "
                  "when evaluating N-MOS.",
            "cn": "分别播放 reference 和处理后的音频，然后<strong>仅</strong>对"
                  "处理后的音频中的<font color=\"red\">噪声级别</font>进行评估，即"
                  "其中的背景噪声是否很好地被抑制。"
                  "<br>"
                  "强干扰性噪声，相应的得分是 0。"
                  "几乎无噪声，相应的得分是 100。"
                  "<br><br>"
                  "<strong>注意：</strong>在评估 N-MOS 分数时，请<u>不要将语音信号的质量考虑在内</u>。",
        },
    },
}


def response_template(metric=None, language="en"):
    if metric is not None and metric not in METRICS:
        raise ValueError(f"Unsupported metric: {metric}")
    if language not in ("en", "cn"):
        raise ValueError(f"Unsupported language: {language}")
    if metric is None or metric == "MOS":
        if language == "en":
            return ["Excellent", "Good", "Fair", "Poor", "Bad"]
        elif language == "cn":
            return ["很好", "好", "较好", "较差", "差"]
    elif metric == "S-MOS":
        if language == "en":
            return ["Not Distorted", "Slightly Distorted", "Somewhat Distorted", "Fairly Distorted", "Very Distorted"]
        elif language == "cn":
            return ["无失真", "轻微失真", "较失真", "相当失真", "极度失真"]
    elif metric == "N-MOS":
        if language == "en":
            return ["Not Noticeable", "Slightly Noticeable", "Noticeable But Not Intrusive", "Somewhat Intrusive", "Very Intrusive"]
        elif language == "cn":
            return ["几乎无噪声", "轻微噪声", "有噪声但无干扰性", "有一定干扰性", "强干扰噪声"]


def make_first_page(language="en"):
    if language == "en":
        return {
            "type": "generic",
            "content": "Welcome to speech enhancement quality evaluation."
                    "<br>"
                    "Please click [Next] button.",
            "id": "welcome",
            "name": "Speech enhancement quality evaluation",
        }
    elif language == "cn":
        return {
            "type": "generic",
            "content": "欢迎来到语音增强质量的主观评测。"
                    "<br>"
                    "请单击 [下页] 按钮。",
            "id": "welcome",
            "name": "语音增强质量评测",
        }
    else:
        raise ValueError(f"Unsupported language: {language}")


def make_explanation_page(language="en"):
    if language == "en":
        return {
            "type": "generic",
            "content": 
                "Listen to a given \"clean\" reference audio and several processed audios. "
                "Then rate the quality of the processed audios from 0 to 100, comparing to the reference audio."
                "<br><br>"
                "<strong>Note</strong>: You may be asked to evaluate multiple metrics for each sample, such as S-MOS, N-MOS, and MOS."
                "<br>"
                "S-MOS means how well the <strong>SPEECH SIGNAL</strong> is preserved in the processed audio, <font color=\"red\">regardless of the background noise</font>. "
                # "<br>"
                # "<font color=\"gray\">(Highly distorted speech is corresponding to 0. Undistorted speech is corresponding to 100.)</font>"
                "<br>"
                "N-MOS means how well the <strong>BACKGROUND NOISE</strong> is suppressed, <font color=\"red\">regardless of the speech signal</font>. "
                # "<br>"
                # "<font color=\"gray\">(Very intrusive noise is corresponding to 0. Unnoticable noise is corresponding to 100.)</font>"
                "<br>"
                "MOS means the <strong>overall quality</strong> of the processed audio, considering <font color=\"red\">both the speech and background noise</font>. "
                # "<br>"
                # "<font color=\"gray\">(Highly distorted speech with very intrusive noise is corresponding to 0. "
                # "Undistorted speech without noticeable noise is corresponding to 100.)</font>"
                "<br>"
                "<br>"
                "<strong>DO NOT CLOSE AND RELOAD THIS PAGE UNTIL THE END OF THIS EVALUATION.</strong>"
                "<br>"
                "<br>"
                "Please click [Next] button.",
            "id": "explanation",
            "name": "Explanation",
        }
    elif language == "cn":
        return {
            "type": "generic",
            "content":
                "分别播放“干净的”reference 和处理后的音频，然后以 reference 音频作为参照，"
                "对处理后的音频的质量进行打分（0 到 100之间）。"
                "<br><br>"
                "<strong>注意：</strong>您可能需要为每个音频样本进行多个指标的打分，比如 S-MOS、N-MOS 和 MOS。"
                "<br>"
                "S-MOS 表示处理后的音频中<strong>语音信号</strong>的质量，"
                "<font color=\"red\">而不关心背景噪声的部分</font>。"
                # "<br>"
                # "<font color=\"gray\">（高度失真的语音，相应的得分是 0。没有任何失真的语音，相应的得分是 100。）</font>"
                "<br>"
                "N-MOS 表示处理后的音频中<strong>背景噪声</strong>的抑制程度，"
                "<font color=\"red\">而不关心语音信号的部分</font>。"
                # "<br>"
                # "<font color=\"gray\">（强干扰性噪声，相应的得分是 0。几乎无噪声，相应的得分是 100。）</font>"
                "<br>"
                "MOS 表示处理后的音频的<strong>整体质量</strong>，即<font color=\"red\">同时考虑语音和背景噪声</font>。"
                # "<br>"
                # "<font color=\"gray\">（伴随着强干扰性噪声，且高度失真的语音，相应的得分是 0。几乎没有噪声，且无失真的语音，相应的得分是 100。）</font>"
                "<br>"
                "<br>"
                "<strong>在主观评测的过程中，直到测试结束之前，请不要关闭或重新加载此页面，否则进度将会丢失。</strong>"
                "<br>"
                "<br>"
                "请单击 [下页] 按钮。",
            "id": "explanation",
            "name": "测试介绍",
        }
    else:
        raise ValueError(f"Unsupported language: {language}")


def make_volume_page(sample_wav_path, language="en"):
    if language == "en":
        volume_page = {
            "type": "volume",
            "content": "This is a speech sample similar to what you will hear during the evaluation.<br>"
                    "Listen to the sample and adjust your volume.<br>"
                    "<br>"
                    "<strong>DURING THE EVALUATION, PLEASE USE HEADPHONES AND WORK IN A QUIET ROOM.</strong>",
            "id": "Volume check",
            "stimulus": sample_wav_path,
            "defaultVolume": 1.0,
        }
    elif language == "cn":
        volume_page = {
            "type": "volume",
            "content": "这是和后面评测中您将听到的音频相似的一个语音样本。请根据它调整耳机的音量。<br>"
                    "<br>"
                    "<strong>在评测过程中，请使用耳机，并在相对安静的房间中进行听音。</strong>",
            "id": "Volume check",
            "stimulus": sample_wav_path,
            "defaultVolume": 1.0,
        }
    else:
        raise ValueError(f"Unsupported language: {language}")
    return volume_page


def make_finish_page(language="en"):
    if language == "en":
        return {
            "type": "finish",
            "content": "The evaluation was finished.<br>"
                    "Please enter your <strong>name</strong>. <br>"
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
    elif language == "cn":
        return {
            "type": "finish",
            "content": "评测结束，请输入您的<strong>名字</strong>，并单击 [提交结果] 按钮。",
            "id": "finish",
            "name": "评测结束",
            "popupContent": "您的评测结果已被记录。感谢您的配合！",
            "showResults": True,
            "writeResults": True,
            "questionnaire": [
                {
                    "type": "text",
                    "label": "名字",
                    "name": "name",
                    "optional": False,
                },
            ]
        }
    else:
        raise ValueError(f"Unsupported language: {language}")


def make_enh_page(idx, total_idx, ref_wav_path, test_wav_dict, metrics, language="en"):
    ref_path = Path(ref_wav_path)
    wav_dir_id = ref_path.parent.name
    wav_file_id = ref_path.stem
    wav_id = f"{wav_dir_id}_{wav_file_id}"
    if language == "en":
        name = f"Speech Enhancement Quality Evaluation ({idx}/{total_idx})"
    elif language == "cn":
        name = f"语音增强质量评测 ({idx}/{total_idx})"
    else:
        raise ValueError(f"Unsupported language: {language}")
    return {
        "type": "multi_metric_mushra",
        "id": wav_id,
        "metrics": metrics,
        "colors": [METRICS[metric]["color"] for metric in metrics],
        "content": [METRICS[metric]["content"][language] for metric in metrics],
        "name": name,
        "mustPlayAll": True,
        "mustViewAllTabs": True,
        "createAnchor35": False,
        "createAnchor70": False,
        "enableLooping": True,
        "showConditionNames": False,
        "randomize": True,
        "reference": ref_wav_path,
        "stimuli": test_wav_dict,
        "response": [response_template(metric, language) for metric in metrics],
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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sample_audio_path", default=None, type=str, nargs="+")
    parser.add_argument("--ref_root_wav_dir", default=None, type=str)
    parser.add_argument("--test_root_wav_dir", required=True, type=str, nargs="+")
    parser.add_argument("--outpath", required=True, type=str)
    parser.add_argument("--metrics", default="MOS", type=str2triple_str)
    parser.add_argument("--seed", default=777, type=int)
    parser.add_argument("--language", default="en", choices=["en", "cn"], type=str)
    parser.add_argument("--random", default=True, type=str2bool, help="Generate evaluation pages with random orders.")
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
        "language": args.language,
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
    config["pages"] += [make_first_page(language=args.language)]
    config["pages"] += [make_explanation_page(language=args.language)]

    if args.sample_audio_path is not None:
        for sample_wav in args.sample_audio_path:
            config["pages"] += [make_volume_page(sample_wav, language=args.language)]

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
                language=args.language,
            )
        )
    config["pages"].append(evaluation_pages)

    config["pages"] += [make_finish_page(language=args.language)]

    with open(args.outpath, "w") as f:
        s = yaml.safe_dump(config, stream=None, allow_unicode=True, encoding="utf-8", line_break=True).decode()
        # insert a linebreak in "- -" so that the web page can be correctly loaded
        s = re.sub(r"(?<=\n)(\s*)- (- .*)\n(\s*)(?=-)", r"\1-\n\3\2\n\3", s)
        f.write(s)


if __name__ == "__main__":
    main()
