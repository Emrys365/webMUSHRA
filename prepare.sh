#!/bin/bash

###################################
# Prepare configs for CHiME4 data #
###################################

# Since webMUSHRA needs stereo audio, we convert the monaural audio to stereo.
if [ ! -L configs/resources/wavs ]; then
    ln -s "$(realpath ../wavs)" configs/resources/wavs
fi
./bin/convert_mono_to_stereo.sh configs/resources/wavs/ configs/resources/wavs_stereo/

# Generate config
./bin/generate_enh_config.py \
    --sample_audio_path configs/resources/wavs_stereo/close_talk/F05_445C0214_STR_REAL.wav \
    --seed 777 \
    --language en \
    --metrics MOS,S-MOS,N-MOS \
    --random True \
    --ref_root_wav_dir ./configs/resources/wavs_stereo/close_talk \
    --test_root_wav_dir ./configs/resources/wavs_stereo/{wav,blstm_mvdr,fasnet,mc_conv_tasnet,beam_tasnet_sig,beam_tasnet_vad_mask,joint_mc_conv_tasnet_asr} \
    --outpath ./configs/enh_quality_MOS_sample.yaml

echo "Run the following command to launch WebMUSHRA:"
echo -e "   php -S 0.0.0.0:8888\n"
echo "Then you can lauch the evaluation by visiting localhost:8888/?config=enh_quality_MOS_sample.yaml"
