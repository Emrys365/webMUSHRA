<?php

function sanitize($string = '', $is_filename = FALSE)
{
    // Replace all weird characters with dashes
    $string = preg_replace('/[^\w\-'. ($is_filename ? '~_\.' : ''). ']+/u', '-', $string);
    // Only allow one dash separator at a time (and make string lowercase)
    return strtolower(preg_replace('/--+/u', '-', $string));
}


if ( isset($_POST['readTsvJSON']) ) {
    // Read from a TSV file (assuming the first line is the header line)
    $tsvParam = null;
    if (version_compare(PHP_VERSION, '7.4.0', '<') AND get_magic_quotes_gpc()) {
        $tsvParam = stripslashes($_POST['readTsvJSON']);
    } else {
        $tsvParam = $_POST['readTsvJSON'];
    }
    $data = json_decode($tsvParam);

    if ($data->tsv == null OR ! is_file($data->tsv)) {
        throw new Exception("The tsv file does not exist: ".$data->tsv);
    }
    $fp = fopen($data->tsv, "r");
    $lineno = 0;
    $tsvData = array();
    if ($fp) {
        // Read TSV line by line to avoid huge memory consumption
        while (($line = fgets($fp)) !== false) {
            if ($lineno == 0) {
                $header = explode("\t", trim($line));
            } else {
                $row = explode("\t", trim($line));
                // $tsvData[] = array_combine($header, $row);
                $tsvData[] = $row;
            }
            $lineno++;
        }
        fclose($fp);

        $tsvData = array(
            "header" => $header,
            "data" => $tsvData
        );
        echo json_encode($tsvData);
    }

} elseif ( isset($_POST['writeTsvJSON']) ) {
    // Write to a TSV file (assuming the first line is the header line)
    $tsvParam = null;
    if (version_compare(PHP_VERSION, '7.4.0', '<') AND get_magic_quotes_gpc()) {
        $tsvParam = stripslashes($_POST['writeTsvJSON']);
    } else {
        $tsvParam = $_POST['writeTsvJSON'];
    }
    $data = json_decode($tsvParam);

    if ($data->tsv == null OR ! file_exists($data->tsv)) {
        throw new Exception("The tsv file does not exist: ".$data->tsv);
    }
    // $filepathPrefix = sanitize($string = $data->tsv, $is_filename =TRUE);
    // $filepathPostfix = ".tsv";
    // $mode = $data->mode;

    // if (!is_dir($filepathPrefix)) {
    //     mkdir($filepathPrefix);
    // }
    // $length = count($data->participant->name);

    // $tsvData = array();

    // $input = array("data_test_id");
    // for($i =0; $i < $length; $i++){
    //     array_push($input, $data->participant->name[$i]);
    // }
    // array_push($input, "trial_id", "tagged_stimulus", "tags", "tagging_time");
    // array_push($tsvData, $input);

    // foreach ($data->trials as $trial) {
    //     if ($trial->type == "wave_spec_tagging") {
    //         $write_tagging = true;

    //         foreach ($trial->responses as $response) {

    //             $results = array($data->testId);
    //             for($i =0; $i < $length; $i++){
    //                 array_push($results, $data->participant->response[$i]);
    //             }
    //             array_push($results, $trial->id, $response->stimulus, $response->labels, $response->time);

    //             array_push($tsvData, $results);
    //         }
    //     }
    // }

    // $filename = $filepathPrefix."tagging".$filepathPostfix;
    // $fp = fopen($filename, $mode);
    // foreach ($tsvData as $row) {
    //     fputcsv($fp, $row, "\t");
    // }
    // fclose($fp);
}

?>