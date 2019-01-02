import React from 'react';
import { shallow } from 'enzyme';
import RadioGroup from '../radio-group';

describe('RadioGroup', () => {
    let wrapper = null;
    const mockOptions = [{
        value: 'a',
        text: 'Label for value a',
    }, {
        value: 'b',
        text: 'Label for value b',
    }];
    const mockSelect = jest.fn();
    const radioGroupName = 'testRadioGroup';

    beforeEach(() => {
        wrapper = shallow(
            <RadioGroup
                name={radioGroupName}
                onSelect={mockSelect}
                options={mockOptions}
                value=""
            />,
        );
    });

    it('should select the correct option when value prop is updated', () => {
        wrapper.setProps({
            value: 'b',
        });
        wrapper.update();
        let pseudoLabels = wrapper.find('label');
        expect(pseudoLabels.length).toBe(2);
        expect(pseudoLabels.at(0).hasClass('selected')).toBe(false);
        expect(pseudoLabels.at(1).hasClass('selected')).toBe(true);
        wrapper.setProps({
            value: 'a',
        });
        wrapper.update();
        pseudoLabels = wrapper.find('label');
        expect(pseudoLabels.at(0).hasClass('selected')).toBe(true);
        expect(pseudoLabels.at(1).hasClass('selected')).toBe(false);
    });

    it('calls onSelect with the correct values when button is clicked and selection radio button', () => {
        wrapper.setProps({
            onSelect: (key, value) => {
                expect(key).toBe(radioGroupName);
                expect(value).toBe(mockOptions[0].value);
                wrapper.setProps({
                    value,
                });
            },
        });
        wrapper.update();
        const mockPreventDefault = jest.fn();
        const textButton = wrapper.find('button');
        expect(textButton.length).toBe(2);
        textButton.at(0).simulate('click', {
            preventDefault: mockPreventDefault,
            target: {
                dataset: {
                    value: textButton.at(0).props()['data-value'],
                },
            },
        });
        wrapper.update();
        expect(wrapper.find('label').at(0).hasClass('selected')).toBe(true);
        expect(mockPreventDefault).toHaveBeenCalled();
    });
});
