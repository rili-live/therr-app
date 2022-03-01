import { ITherrTheme } from "../themes";

const containerStyles: any = {
    marginTop: 18,
    marginBottom: 20,
    marginHorizontal: 10,
};

const containerTightStyles: any = {
    marginTop: 5,
    marginBottom: 5,
};

const containerNoHorizontalStyles: any = {
    marginTop: 0,
    marginBottom: 20,
    marginHorizontal: 0,
};

const getTextInputStyle = (theme: ITherrTheme) : any => ({
    marginLeft: 10,
    marginRight: 10,
    marginBottom: 20,
    fontSize: 19,
    borderColor: theme.colors.borderLight,
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
});

const inputStyle: any = {
    fontSize: 19,
    padding: 10,
};

export {
    containerStyles,
    containerTightStyles,
    containerNoHorizontalStyles,
    getTextInputStyle,
    inputStyle,
};
