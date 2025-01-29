/**
 * @jest-environment jsdom
 */
import * as React from 'react';
import { shallow } from 'enzyme';
import { Key as KeyCode } from 'ts-keycode-enum';
import { act } from 'react-test-renderer';
import SelectBox from '../SelectBox';

describe('SelectBox', () => {
    let wrapper: any;
    const mockOptions = [
        {
            value: '',
            text: 'Empty option',
        },
        {
            value: 'choice1',
            text: 'Choice 1',
        },
        {
            value: 'choice2',
            text: 'Choice 2',
        },
    ];
    const mockPreventDefault = jest.fn();
    const mockTranslate = (key: any) => key;
    const testId = 'test-id';

    beforeEach(() => {
        wrapper = shallow(
            <SelectBox id={testId} options={mockOptions} onChange={jest.fn()} translate={mockTranslate} value={mockOptions[1].value} />,
        );
    });

    const simulateButtonKeydown = (keyCode: any) => {
        act(() => wrapper.find('button').simulate('keyDown', {
            keyCode,
            preventDefault: mockPreventDefault,
        }));
    };

    it('should initialize with expected option selected', () => {
        expect(wrapper.find('button').text()).toBe(mockOptions[1].text);
    });

    it('hides options when clicked outside of component', () => {
        act(() => wrapper.instance().toggleSelectionVisibility());
        expect(wrapper.state().optionsAreVisible).toBe(true);
        act(() => wrapper.instance().handlePageClick({
            target: 'not-the-button-element',
        }));
        expect(wrapper.state().optionsAreVisible).toBe(false);
    });

    it('applies and removes "is-invalid" class when validity changes', () => {
        expect(wrapper.find('.select-box').length).toBe(1);
        expect(wrapper.find('.select-box').hasClass('is-invalid')).toBe(false);
        wrapper.setProps({
            required: true,
            value: mockOptions[0].value,
        });
        expect(wrapper.find('.select-box').hasClass('is-invalid')).toBe(true);
        wrapper.setProps({
            value: mockOptions[2].value,
        });
        expect(wrapper.find('.select-box').hasClass('is-invalid')).toBe(false);
    });

    it('applies and removes "is-valid" class when validity changes', () => {
        expect(wrapper.find('.select-box').length).toBe(1);
        expect(wrapper.find('.select-box').hasClass('is-valid')).toBe(false);
        wrapper.setProps({
            required: true,
        });
        expect(wrapper.find('.select-box').hasClass('is-valid')).toBe(true);
        wrapper.setProps({
            value: mockOptions[0].value,
        });
        expect(wrapper.find('.select-box').hasClass('is-valid')).toBe(false);
    });

    it('applies "disabled" class when disabled and disables interaction', () => {
        wrapper.setProps({
            disabled: true,
        });
        expect(wrapper.find('.select-box').hasClass('disabled')).toBe(true);
        expect(wrapper.state().optionsAreVisible).toBe(false);
        act(() => wrapper.instance().toggleSelectionVisibility());
        expect(wrapper.state().optionsAreVisible).toBe(false);
        wrapper.find('button').simulate('focus');
        wrapper.find('button').simulate('keyDown', {
            preventDefault: mockPreventDefault,
            keyCode: KeyCode.Enter,
        });
        wrapper.update();
        expect(mockPreventDefault).not.toHaveBeenCalled();
        expect(wrapper.state().optionsAreVisible).toBe(false);
    });

    it('applies "is-touched" class when input is focused', () => {
        expect(wrapper.find('.select-box').length).toBe(1);
        expect(wrapper.find('.select-box').hasClass('is-touched')).toBe(false);
        act(() => wrapper.instance().onFocus());
        wrapper.update();
        expect(wrapper.find('.select-box').hasClass('is-touched')).toBe(true);
    });

    it('updates input with correct, supplied value', () => {
        const expectedText = mockOptions[1].text;
        act(() => wrapper.instance().handleSelectionChange({
            preventDefault: jest.fn(),
            target: {
                dataset: {
                    index: 1,
                },
            },
        }));
        wrapper.update();
        expect(wrapper.find('.select-box').text()).toBe(expectedText);
    });

    it('highlights the correct option using AX arrow keys', () => {
        act(() => wrapper.instance().toggleSelectionVisibility());
        wrapper.update();
        expect(wrapper.state().optionsAreVisible).toBe(true);
        expect(wrapper.find('.option-container').length).toBe(3);
        expect(wrapper.state().axIndex).toBe(1);

        simulateButtonKeydown(KeyCode.DownArrow);
        expect(mockPreventDefault).toHaveBeenCalledTimes(1);
        expect(wrapper.state().axIndex).toBe(2);

        simulateButtonKeydown(KeyCode.DownArrow);
        expect(mockPreventDefault).toHaveBeenCalledTimes(2);
        expect(wrapper.state().axIndex).toBe(0);

        simulateButtonKeydown(KeyCode.UpArrow);
        expect(mockPreventDefault).toHaveBeenCalledTimes(3);
        expect(wrapper.state().axIndex).toBe(2);

        simulateButtonKeydown(KeyCode.Enter);
        expect(mockPreventDefault).toHaveBeenCalledTimes(4);
        wrapper.update();
        expect(wrapper.state().axIndex).toBe(2);
        expect(wrapper.state().optionsAreVisible).toBe(false);
        expect(wrapper.find('.option-container').length).toBe(0);

        act(() => wrapper.instance().toggleSelectionVisibility());
        wrapper.update();
        expect(wrapper.state().optionsAreVisible).toBe(true);
        expect(wrapper.find('.option-container').length).toBe(3);

        simulateButtonKeydown(KeyCode.Tab);
        // event.preventDefault does not get called when TAB key is pressed
        expect(mockPreventDefault).toHaveBeenCalledTimes(4);
        expect(wrapper.state().axIndex).toBe(1);
    });
});
