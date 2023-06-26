import React, {
    useCallback,
} from 'react';
import { Image } from 'react-bootstrap';
import {
    useDropzone,
} from 'react-dropzone';

interface IDropzoneProps {
    dropZoneText: string;
    onMediaSelect: (files: any[]) => any;
    initialFileUrl?: string;
}

const Dropzone = ({
    dropZoneText,
    onMediaSelect,
    initialFileUrl,
}: IDropzoneProps) => {
    const [files, setFiles] = React.useState([]);

    const onDrop = useCallback((acceptedFiles) => {
        setFiles(acceptedFiles.map((file: any) => ({
            ...file,
            preview: URL.createObjectURL(file),
        })));
        onMediaSelect(acceptedFiles);
        // acceptedFiles.forEach((file) => {
        //     const reader = new FileReader();

        //     reader.onabort = () => console.log('file reading was aborted');
        //     reader.onerror = () => console.log('file reading has failed');
        //     reader.onload = () => {
        //         // Do whatever you want with the file contents
        //         const binaryStr = reader.result;
        //         console.log(binaryStr);
        //     };
        //     reader.readAsArrayBuffer(file);
        // });
    }, []);
    const {
        getRootProps,
        getInputProps,
    } = useDropzone({
        onDrop,
        multiple: false,
    });

    return (
        <div {...getRootProps()} className="dropzone rounded d-flex align-items-center justify-content-center">
            {
                (files.length > 0 || initialFileUrl)
                    ? <div className="dropzone-square">
                        <Image src={(files.length > 0 ? files[0].preview : initialFileUrl)} className="dropzone-image rounded" />
                        <input {...getInputProps()} />
                    </div>
                    : <>
                        <input {...getInputProps()} />
                        <p className="px-4 my-4">{dropZoneText}</p>
                    </>
            }
        </div>
    );
};

export default Dropzone;
