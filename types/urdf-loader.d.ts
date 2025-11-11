declare module 'urdf-loader' {
  import { Loader, LoadingManager, Group } from 'three';

  export interface URDFJoint {
    name?: string;
    setJointValue?: (value: number) => void;
  }

  export interface URDFLink extends Group {}

  export interface URDFRobot extends Group {
    joints: Record<string, URDFJoint>;
    links: Record<string, URDFLink>;
  }

  export default class URDFLoader extends Loader<URDFRobot> {
    packages: Record<string, string>;
    loadMeshCb?: (
      path: string,
      manager: LoadingManager,
      onComplete: (group: Group) => void
    ) => void;
  }
}


