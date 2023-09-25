import classNames from 'classnames';
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
    disabled?: boolean;
    multiple?: boolean;
}

const Dropzone = ({
    dropZoneText,
    onMediaSelect,
    initialFileUrl,
    disabled,
    multiple,
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
        accept: {
            'image/png': ['.png'],
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/webp': ['.webp'],
        },
        onDrop,
        disabled,
        multiple,
    });

    const dropzoneClassNames = classNames({
        dropzone: true,
        rounded: true,
        'd-flex': true,
        'align-items-center': true,
        'justify-content-center': true,
        disabled,
    });

    return (
        <div {...getRootProps()} className={dropzoneClassNames}>
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
