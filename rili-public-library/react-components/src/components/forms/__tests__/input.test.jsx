import React from 'react';
import { mount } from 'enzyme';
import Input from '../input';
import VALIDATIONS from '../constants/validations';

describe('Input', () => {
    let wrapper;
    const inputName = 'test-input';
    const mockOnValidate = jest.fn();
    const mockTranslate = key => key;

    beforeEach(() => {
        wrapper = mount(
            <Input id={inputName} name={inputName} onChange={jest.fn()} onValidate={mockOnValidate} translate={mockTranslate} />,
        );
    });

    it('applies and removes "is-dirty" class when text is added and removed', () => {
        const expectedValue = 'Test entry';
        wrapper.instance().handleInputChange({
            target: {
                name: inputName,
                value: expectedValue,
            },
        });
        wrapper.update();
        expect(wrapper.state().inputValue).toBe(expectedValue);
        expect(wrapper.find('input').hasClass('is-dirty')).toBe(true);
        wrapper.instance().handleInputChange({
            target: {
                name: inputName,
                value: '',
            },
        });
        wrapper.update();
        expect(wrapper.state().inputValue).toBe('');
        expect(wrapper.find('input').hasClass('is-dirty')).toBe(false);
        expect(wrapper.props().onChange).toHaveBeenCalledTimes(2);
    });

    it('applies "is-touched" class when input is focused', () => {
        expect(wrapper.find('input').length).toBe(1);
        expect(wrapper.find('input').hasClass('is-touched')).toBe(false);
        wrapper.find('input').simulate('focus');
        wrapper.update();
        expect(wrapper.find('input').hasClass('is-touched')).toBe(true);
    });

    it('applies and removes "is-invalid" class when validity changes', () => {
        expect(wrapper.find('input').length).toBe(1);
        expect(wrapper.find('input').hasClass('is-invalid')).toBe(false);
        wrapper.setProps({
            validations: ['isRequired'],
        });
        wrapper.update();

        expect(wrapper.find('input').hasClass('is-invalid')).toBe(true);
        wrapper.setProps({
            value: 'Test text',
        });
        wrapper.update();

        expect(wrapper.find('input').hasClass('is-invalid')).toBe(false);
    });

    it('applies and removes "is-valid" class when validity changes', () => {
        expect(wrapper.find('input').length).toBe(1);
        wrapper.setProps({
            validations: ['isRequired'],
        });
        wrapper.update();

        expect(wrapper.find('input').hasClass('is-valid')).toBe(false);
        wrapper.find('input').simulate('focus');
        wrapper.setProps({
            value: 'Test text',
        });
        wrapper.update();

        expect(wrapper.find('input').hasClass('is-valid')).toBe(true);
        wrapper.setProps({
            value: '',
        });
        wrapper.update();

        expect(wrapper.find('input').hasClass('is-valid')).toBe(false);
    });

    it('updates input with correct, supplied value', () => {
        const expectedValue = 'Test entry';
        wrapper.instance().handleInputChange({
            target: {
                name: inputName,
                value: expectedValue,
            },
        });
        wrapper.update();
        const input = wrapper.find('input');

        // This prop is not really a React prop, but rather the value property on a standard input
        expect(input.props().value).toBe(expectedValue);
    });

    it('updates input text based on props', () => {
        const expectedValue = 't-rex entry';
        wrapper.setProps({
            value: expectedValue,
        });
        wrapper.update();
        const input = wrapper.find('input');

        expect(input.props().value).toBe(expectedValue);
    });

    it('maintains current validations and error messages', () => {
        wrapper.find('input').simulate('focus');
        wrapper.update();
        wrapper.setProps({
            validations: ['isRequired', 'lettersOnly', 'numbersOnly'],
        });
        wrapper.update();

        expect(wrapper.find('.validation-errors').length).toBe(1);
        expect(wrapper.find('.message-container').length).toBe(1);
        expect(wrapper.find('.message-container').text()).toBe(mockTranslate(VALIDATIONS.isRequired.errorMessageLocalizationKey));

        wrapper.setProps({
            value: 'abc123',
        });
        wrapper.update();

        expect(wrapper.find('.validation-errors').length).toBe(1);
        expect(wrapper.find('.message-container').length).toBe(2);
        expect(wrapper.find('.message-container').at(0).text()).toBe(mockTranslate(VALIDATIONS.lettersOnly.errorMessageLocalizationKey));
        expect(wrapper.find('.message-container').at(1).text()).toBe(mockTranslate(VALIDATIONS.numbersOnly.errorMessageLocalizationKey));

        wrapper.setProps({
            value: '12345',
            validations: ['isRequired', 'numbersOnly'],
        });
        wrapper.update();

        expect(wrapper.find('.validation-errors').length).toBe(0);
        expect(wrapper.find('.message-container').length).toBe(0);
        expect(mockOnValidate).toHaveBeenLastCalledWith({
            [inputName]: [],
        });
    });
});
