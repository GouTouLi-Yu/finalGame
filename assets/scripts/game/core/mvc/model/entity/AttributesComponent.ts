import { ClassConfig } from 'db://assets/scripts/frame/Injector/ClassConfig';
import { EComponentType, IComponent } from './ComponentType';


export class AttributesComponent implements IComponent {
    readonly type: EComponentType.attributes = EComponentType.attributes;

    serialize(): any {
        return null;
    }

    deserialize(): any {
        return null;
    }
}
ClassConfig.addClass("AttributesComponent", AttributesComponent);

