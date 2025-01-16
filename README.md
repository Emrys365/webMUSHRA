# webMUSHRA
[![GitHub release](https://img.shields.io/github/release/audiolabs/webMUSHRA.svg)](https://github.com/audiolabs/webMUSHRA/releases/latest)
[![Github All Releases](https://img.shields.io/github/downloads/audiolabs/webMUSHRA/total.svg)](https://github.com/audiolabs/webMUSHRA/releases/latest)
[![Build Status](https://travis-ci.org/audiolabs/webMUSHRA.svg?branch=master)](https://travis-ci.org/audiolabs/webMUSHRA)
[![DOI](https://zenodo.org/badge/81722942.svg)](https://zenodo.org/badge/latestdoi/81722942)

a MUltiple Stimuli with Hidden Reference and Anchor ([MUSHRA](https://en.wikipedia.org/wiki/MUSHRA)) compliant web audio API based experiment software.

(Modified from the [kan-bayashi/webMUSHRA](https://github.com/kan-bayashi/webMUSHRA) repository)

> ## New features
> 1. Add a new page type: [TaggingPage](lib/webmushra/pages/TaggingPage.js).
> <br/>As shown below, this new page supports adding various pre-defined tags to for each audio sample.
> <br/>And users can easily navigate between different audios by either using the shortcuts `[` and `]` or clicking the `<` and `>` buttons on the upper left.
> <br/><img width="1011" alt="screenshot of TaggingPage" src="https://github.com/user-attachments/assets/1f618220-d34d-4e8a-ac8e-0d6892c22ea0">
>   * Several options are supported:
>     * `audioList`: the path to a tsv file containing a list of audios.
>     * `shuffleAudio`: whether to randomly shuffle the audio list for loading in a random order.
>     * `labelCache`: If true, the browser's localStorage will be used for storing and loading labeled tags in the past. This is useful for resuming the tagging process after the browser tab is closed.
>     * `waveformColors`: define the colors of each part of the waveform for each audio. See [configs/default.yaml](configs/default.yaml) for an example.
>     * `staticWaveform`: if false, the waveform will be refreshed during playing to reflect the player progress (this may cause laggy playing for long audios due to intensive computations); otherwise, the waveform will not be refreshed during playing (notPlayedColor will be ignored).
>     * `showCursor`: whether to show a vertical cursor to indicate the current audio playing position
>     * `showMetaInfo`: whether to show the meta information of each audio (if available) in the page.
>     * `showSpectrogram`: whether to display the spectrogram of each audio (the original sampling rate will be used if loadOrigSR === true).
>     * `spectrogramOptions`: the options for displaying the spectrogram. See [lib/webmushra/misc/AudioAnalyzer.js](lib/webmushra/misc/AudioAnalyzer.js) for more details.
>     * `enableLooping`: whether to automatically play the audio in a loop.
>     * `mustViewAllAudios`: f true, the Next button will be disabled until all audios have been tagged.
>     * `normalizeVolume`: if not null, automatically rescale the volume of each audio so that its maximum absolute value is the specified value.
>     * `tags`: a list of tags to be evaluated. See [configs/default.yaml](configs/default.yaml) for an example.
> 
> <br/>Different from other pages, the TaggingPage will load all its audios in a lazy mode rather than loading all audios at once. This is useful for handling a large number of audios (specified in `audioList`). A cache of loaded audios is also available (up to 10 most recently loaded audios; see [lib/webmushra/audio/AudioFileLoader.js](lib/webmushra/audio/AudioFileLoader.js)).
>
> The spectrogram and waveform visualization functions are totally refactored following the design in [https://github.com/sukumo28/vscode-audio-preview](https://github.com/sukumo28/vscode-audio-preview). The same interaction features are also supported, such jump playing by a single click, zoom in by dragging, reset zooming by a right cick, and meta keys (ctrl and shift) during dragging. Some bugs in spectrogram visualization in the original VSCode extension (e.g., color consistency in zoomed and default views) are also fixed.
>
> The new page works best on Google Chrome, but can also work in other browsers such as Safari.
> 
> 2. Add a new page type: [MultiMetricMushraPage](lib/webmushra/pages/MultiMetricMushraPage.js).
> <br/>As shown below, this new page supports evaluating multiple metrics for each audio sample.
> <br/>And users can easily navigate between different tabs by using the shortcuts `[` and `]`.
> <br/><img width="1011" alt="screen shot 2021-08-08 at 02 54 40" src="https://user-images.githubusercontent.com/18532145/128611084-57d4f393-a14e-4d8f-9929-552b7f11dc37.png">
>   * Several new options are added:
>     * `colors`: a list of colors (HEX) corresponding to the background color of each metric tab.
>     * `content`: a list of documentation corresponding to each metric.
>     * `language`: the locale code, e.g. "en" and "cn".
>     * `metrics`: a list of metrics to be evaluated.
>     * `mustPlayAll`: If true, the Next button will be disabled until all audios have been played.
>     * `mustViewAllTabs`: If true, the Next button will be disabled until all tabs have been viewed.
> 
> <br/>In addition, the page number (i.e. `[page_index]/[total_page]`) in the page title will be automatically re-indexed for handling the randomized page order.
> 
> 3. Support opening the shortcuts cheatsheet on specific pages with the shortcut `/`.
> <br/>Currently supported pages: [MultiMetricMushraPage](lib/webmushra/pages/MultiMetricMushraPage.js) and [TaggingPage](lib/webmushra/pages/TaggingPage.js)
> <br/><details><summary>Expand to see an example</summary><div><img width="1011" alt="screen shot 2021-08-08 at 03 08 42" src="https://user-images.githubusercontent.com/18532145/128611385-1273d5d9-2d7a-4a28-9f57-169aaf434035.png"/></div></details>

## Introduction

Listening tests are widely used to assess the quality of audio systems. In the last few years, conducting listening experiments over the Internet, as so called web-based experiments, has become popular. Until now, it was only possible to implement a limited number of listening test types as web-based experiments because web standards were missing some crucial features, e.g. sample manipulation of audio streams. MUSHRA tests are designed to compare the audio quality of several test conditions with intermediate impairments to a high quality reference. With the rise of [Web Audio API](http://webaudio.github.io/web-audio-api/), for the first time MUSHRA experiments can be carried out within the web browser while at the same time being compliant to the ITU-R Recommendation BS.1534 (MUSHRA).

##### [View Demo](https://audiolabs.github.io/webMUSHRA)


### Download

We provide two version of webMUSHRA.

* __webMUSHRA__ provides the version targeted for normale usage and experimenters. The javascript files are compressed which makes it faster to load/serve. The documentation is provided as PDFs.

* __webMUSHRA-dev__ is targeted to developers and experienced users who want to customize experiments. This version is comparable to cloning the git repository

[Download Package Here](https://github.com/audiolabs/webMUSHRA/releases/latest)

## Features

* page based experiments supporting:
  * MUSHRA (ITU-R BS.1534)
  * AB (ITU-R BS.1116)
  * Likert scale questionaires
  * training/introduction
  * spatial attributes, such as ASW, LEV, and localization (experimental)
* compliant to ITU recommendations (looping, fade-in/out, sample accurate switching)
* finish page to gather the results and send them to a provided PHP service
* client side processing using the Web Audio API
* simple configuration using YAML preference files
* automatically generates ITU-R compliant lower anchor files on the fly
* keyboard shortcuts for interaction with main UI elements

## Supported Browsers

 * Google Chrome on Windows, Mac and Linux
 
## Getting started: Setting up webMUSHRA using PHP's builtin webserver

To load audio files and save the results as csv text files, webMUSHRA needs to run on a web server. If you already have `php` installed on your system (for example on Mac OS X), you can run a php development server on port 8000 from the terminal using `php -S localhost:8000`.

Now you can run webMUSHRA using the following URL: http://localhost:8000

The experiment configurations are stored in the `configs/` folder. To load a configuration/experiment, specify the `config` argument in the url http://localhost:8000/?config=mushra_showresults.yaml.

### Docker

You can use docker to set up webMUSHRA quickly. Just run
`docker-compose -f docker-compose.yml build` to build the webMUSHRA docker container.

To run the container use webMUSHRA `docker-compose -f docker-compose.yml up`. We configured the docker image so that the `configs` and the `results` folder is mounted inside the container so that you can modify it on the fly and receive results within the `results` folder.

#### Note for Docker on Windows

When using Docker Toolbox/Machine on Windows, volume paths (to mount the `configs` and `results` folder) are not converted by default. To enable this conversion set the environment variable COMPOSE_CONVERT_WINDOWS_PATHS=1 e.g. by `env:COMPOSE_CONVERT_WINDOWS_PATHS=1` in the power shell.

### Apache + PHP
Another custom way to run webMUSHRA would be to install a complete web server stack like [XAMPP](https://www.apachefriends.org/download.html).

#### Change or add a configuration

webMUSHRA uses [YAML](https://en.wikipedia.org/wiki/YAML) to configure experiments. Since YAML is using whitespace indentation (no tab characters!), we recommend to use a text editor like [Atom](http://atom.io) that ships with YAML support.

A simple MUSHRA test in YAML looks like this:

```yaml
pages:
  - type: mushra
    id: Item 1
    name: Orchestra
    content: Add additional notes for the participants
    showWaveform: true
    reference: reference.wav
    createAnchor35: true
    createAnchor70: true
    stimuli:
      C1: codec1.wav
      C2: codec2.wav
      C3: codec3.wav
```

The specific parameters are described in the [Experimenters Manual](doc/experimenter.md).

## Documentation

 * [Experimenters Manual](doc/experimenter.md)
 * [Participants Manual](doc/participant.md)

## Citation

If you use webMUSHRA in your publication, please cite it using the following reference:

> Schoeffler, M. et al., (2018). webMUSHRA — A Comprehensive Framework for Web-based Listening Tests. Journal of Open Research Software. 6(1), p.8.

## References

* [Journal of Open Research Software Paper](http://doi.org/10.5334/jors.187)
* [Web Audio Conference 2015 Paper](http://wac.ircam.fr/pdf/wac15_submission_8.pdf)
* [Web Audio Conference 2015 Presentation](http://www.audiolabs-erlangen.de/content/resources/webMUSHRA/slides.html#/)

## Copyright/Licence

(C) AudioLabs 2017

This source code is protected by copyright law and international treaties. This source code is made available to you subject to the terms and conditions of the Software License for the webMUSHRA.js Software. Said terms and conditions have been made available to you prior to your download of this source code. By downloading this source code you agree to be bound by the above mentionend terms and conditions, which can also be found [here.](LICENSE.txt)
Any unauthorised use of this source code may result in severe civil and criminal penalties, and will be prosecuted to the maximum extent possible under law.
